// GET /api/users/[id] — Perfil público de un miembro del gremio
// Visible para cualquier usuario con sesión activa. Incluye logros,
// contadores de actividad y la agregación de resultados reportados
// en sus publicaciones (evidencia del avance real).
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, ApiError, handleApiError } from "@/lib/api-helpers"
import { ACHIEVEMENTS, getLevelInfo } from "@/lib/gamification"
import { isVerifiedUser } from "@/lib/profile"
import type { PublicProfileUser } from "@/lib/types"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      include: { achievements: { orderBy: { createdAt: "asc" } } },
    })
    // Un miembro bloqueado no tiene presencia pública en el gremio
    if (!user || user.status === "BLOCKED") {
      throw new ApiError(404, "Miembro no encontrado")
    }

    const [postCount, commentCount, metrics] = await Promise.all([
      db.post.count({ where: { userId: id } }),
      db.comment.count({ where: { userId: id } }),
      // Solo posts CON resultados reportados (alguna métrica no null)
      db.post.aggregate({
        where: {
          userId: id,
          OR: [
            { metricRevenue: { not: null } },
            { metricOrders: { not: null } },
            { metricRoas: { not: null } },
          ],
        },
        _count: { _all: true },
        _sum: { metricRevenue: true, metricOrders: true },
        _avg: { metricRoas: true },
        _max: { createdAt: true },
      }),
    ])

    const profile: PublicProfileUser = {
      id: user.id,
      name: user.name,
      image: user.image,
      avatarColor: user.avatarColor,
      headline: user.headline,
      bio: user.bio,
      coverImage: user.coverImage,
      verified: isVerifiedUser(user),
      xp: user.xp,
      level: getLevelInfo(user.xp),
      createdAt: user.createdAt.toISOString(),
      experience: user.experience,
      postCount,
      commentCount,
      achievements: user.achievements.map((a) => ({
        code: a.code,
        label: ACHIEVEMENTS[a.code]?.label ?? a.code,
        icon: ACHIEVEMENTS[a.code]?.icon ?? "Award",
        createdAt: a.createdAt.toISOString(),
      })),
      results: {
        reports: metrics._count._all,
        totalRevenue: metrics._sum.metricRevenue ?? 0,
        totalOrders: metrics._sum.metricOrders ?? 0,
        avgRoas: metrics._avg.metricRoas ?? null,
        lastReportAt: metrics._max.createdAt
          ? metrics._max.createdAt.toISOString()
          : null,
      },
      isOwn: user.id === me.id,
    }

    return Response.json({ user: profile })
  } catch (e) {
    return handleApiError(e)
  }
}

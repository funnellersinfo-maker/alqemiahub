// GET /api/admin/stats — Métricas del Panel Admin (header x-admin-key)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError } from "@/lib/api-helpers"
import type { AdminStats } from "@/lib/types"

/** Clave de día local YYYY-MM-DD (según el timezone del servidor) */
function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)

    // Ventana de 14 días calendario (incluye hoy): [hoy-13 ... hoy]
    const dayStarts: Date[] = []
    const dayKeys: string[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      dayStarts.push(d)
      dayKeys.push(dayKey(d))
    }
    const windowStart = dayStarts[0]

    const [
      totalUsers,
      blockedUsers,
      activeUsers7d,
      totalPosts,
      totalComments,
      totalLikes,
      lessonsCompleted7d,
      totalXpAggregate,
      signups,
      creatorCandidates,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: "BLOCKED" } }),
      db.user.count({
        where: { status: "ACTIVE", lastActiveAt: { gte: sevenDaysAgo } },
      }),
      db.post.count(),
      db.comment.count(),
      db.like.count(),
      db.lessonProgress.count({ where: { completedAt: { gte: sevenDaysAgo } } }),
      db.user.aggregate({ _sum: { xp: true } }),
      db.user.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      db.user.findMany({
        include: { _count: { select: { posts: true, comments: true } } },
        orderBy: { xp: "desc" },
        take: 50,
      }),
    ])

    const totalXp = totalXpAggregate._sum.xp ?? 0

    // Signups agrupados por día local (14 días, días sin registros en 0)
    const countByDay = new Map<string, number>()
    for (const u of signups) {
      const key = dayKey(u.createdAt)
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1)
    }
    const signupsByDay = dayKeys.map((date) => ({
      date,
      count: countByDay.get(date) ?? 0,
    }))

    // Top creadores: más publicaciones (empate: más comentarios)
    const topCreators = [...creatorCandidates]
      .sort((a, b) => {
        const byPosts = b._count.posts - a._count.posts
        if (byPosts !== 0) return byPosts
        return b._count.comments - a._count.comments
      })
      .slice(0, 5)
      .map((u) => ({
        id: u.id,
        name: u.name,
        image: u.image,
        avatarColor: u.avatarColor,
        xp: u.xp,
        posts: u._count.posts,
        comments: u._count.comments,
      }))

    const stats: AdminStats = {
      totalUsers,
      activeUsers7d,
      blockedUsers,
      totalPosts,
      totalComments,
      totalLikes,
      lessonsCompleted7d,
      totalXp,
      signupsByDay,
      topCreators,
    }
    return Response.json(stats)
  } catch (e) {
    return handleApiError(e)
  }
}

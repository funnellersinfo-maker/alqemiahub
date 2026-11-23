// GET /api/leaderboard — Top 10 miembros por XP.
// El Titular (ADMIN) es SIEMPRE el #1 del gremio con XP INFINITUM.
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError } from "@/lib/api-helpers"
import { getDisplayLevel } from "@/lib/gamification"
import { isVerifiedUser } from "@/lib/profile"
import type { LeaderboardEntry } from "@/lib/types"

export async function GET() {
  try {
    await requireActiveUser()

    const top = await db.user.findMany({
      where: { status: "ACTIVE" },
      // "ADMIN" < "USER" alfabéticamente → el titular encabeza siempre
      orderBy: [{ role: "asc" }, { xp: "desc" }],
      take: 10,
      select: {
        id: true,
        name: true,
        image: true,
        avatarColor: true,
        headline: true,
        xp: true,
        verified: true,
        role: true,
      },
    })

    const entries: LeaderboardEntry[] = top.map((u) => ({
      id: u.id,
      name: u.name,
      image: u.image,
      avatarColor: u.avatarColor,
      headline: u.headline,
      xp: u.xp,
      level: getDisplayLevel(u),
      verified: isVerifiedUser(u),
      role: u.role === "ADMIN" ? "ADMIN" : "USER",
    }))

    return Response.json({ top: entries })
  } catch (e) {
    return handleApiError(e)
  }
}

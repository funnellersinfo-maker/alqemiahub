// GET /api/leaderboard — Top 10 miembros por XP
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError } from "@/lib/api-helpers"
import { getLevelInfo } from "@/lib/gamification"
import type { LeaderboardEntry } from "@/lib/types"

export async function GET() {
  try {
    await requireActiveUser()

    const top = await db.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { xp: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        image: true,
        avatarColor: true,
        headline: true,
        xp: true,
      },
    })

    const entries: LeaderboardEntry[] = top.map((u) => ({
      id: u.id,
      name: u.name,
      image: u.image,
      avatarColor: u.avatarColor,
      headline: u.headline,
      xp: u.xp,
      level: getLevelInfo(u.xp),
    }))

    return Response.json({ top: entries })
  } catch (e) {
    return handleApiError(e)
  }
}

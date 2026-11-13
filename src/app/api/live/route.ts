// GET /api/live — Estado del canal EN VIVO para la comunidad
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError } from "@/lib/api-helpers"
import type { LiveSessionDTO, LiveResponse } from "@/lib/types"

function toDTO(l: {
  id: string
  title: string
  description: string
  status: string
  scheduledAt: Date
  coverImage: string | null
  streamUrl: string | null
  replayUrl: string | null
  createdAt: Date
}): LiveSessionDTO {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    status: l.status as LiveSessionDTO["status"],
    scheduledAt: l.scheduledAt.toISOString(),
    coverImage: l.coverImage,
    streamUrl: l.streamUrl,
    replayUrl: l.replayUrl,
    createdAt: l.createdAt.toISOString(),
  }
}

export async function GET() {
  try {
    await requireActiveUser()

    const [current, next, replays] = await Promise.all([
      db.liveSession.findFirst({ where: { status: "LIVE" }, orderBy: { scheduledAt: "desc" } }),
      db.liveSession.findFirst({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
        orderBy: { scheduledAt: "asc" },
      }),
      db.liveSession.findMany({
        where: { status: "ENDED" },
        orderBy: { scheduledAt: "desc" },
        take: 30,
      }),
    ])

    const res: LiveResponse = {
      current: current ? toDTO(current) : null,
      next: next ? toDTO(next) : null,
      replays: replays.filter((r) => r.replayUrl || r.coverImage).map(toDTO),
    }
    return Response.json(res)
  } catch (e) {
    return handleApiError(e)
  }
}

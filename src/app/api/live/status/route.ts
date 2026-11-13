// GET /api/live/status — ¿Hay una transmisión EN VIVO ahora? (polling del nav)
import { db } from "@/lib/db"
import { getSessionUser, handleApiError } from "@/lib/api-helpers"

export async function GET() {
  try {
    await getSessionUser()
    const current = await db.liveSession.findFirst({
      where: { status: "LIVE" },
      select: { id: true },
    })
    return Response.json({ isLive: Boolean(current) })
  } catch (e) {
    return handleApiError(e)
  }
}

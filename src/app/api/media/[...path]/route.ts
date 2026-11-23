// ============================================================
// /api/media/[...path] — Reproducción de vídeos subidos por el
// titular (muro y lecciones). Solo miembros del gremio.
//
// Soporta Range (adelantar/retroceder el vídeo): 200 completo,
// 206 parcial, 404 y 416. Respuesta 100% en streaming.
// ============================================================

import { NextRequest } from "next/server"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { MEDIA_KEY_RE, getMediaResponse } from "@/lib/media-store"

type Ctx = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireActiveUser()
    void user // los vídeos son contenido exclusivo del gremio

    const { path } = await ctx.params
    const key = (path ?? []).join("/")
    if (!MEDIA_KEY_RE.test(key)) return errorResponse(404, "No encontrado")

    return await getMediaResponse(key, req.headers.get("range"))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function HEAD(req: NextRequest, ctx: Ctx) {
  const res = await GET(req, ctx)
  return new Response(null, { status: res.status, headers: res.headers })
}

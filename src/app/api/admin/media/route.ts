// ============================================================
// /api/admin/media — Subida y borrado de vídeos del titular
// (muro y lecciones). Solo admin.
//
// POST   ?key=muro/muro-video.mp4  (cuerpo = bytes del archivo,
//        streaming, Content-Length obligatorio) → { ok, url }
// DELETE ?key=… → { ok }
//
// El archivo se guarda troceado en el Durable Object (producción)
// o en disco (desarrollo). Se sirve por /api/media/[...path].
// ============================================================

import { NextRequest } from "next/server"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import { MEDIA_KEY_RE, MAX_MEDIA_BYTES, mediaUrl, putMedia, deleteMedia } from "@/lib/media-store"

const ACCEPTED_TYPES = /^(video\/mp4|video\/webm|video\/quicktime)(;.*)?$/i

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")

    const key = new URL(req.url).searchParams.get("key") ?? ""
    if (!MEDIA_KEY_RE.test(key)) return errorResponse(400, "Clave de archivo inválida")

    const contentType = req.headers.get("content-type") ?? ""
    if (!ACCEPTED_TYPES.test(contentType)) {
      return errorResponse(415, "Formato no soportado: sube un archivo MP4, WebM o MOV")
    }

    const length = Number(req.headers.get("content-length") ?? "0")
    if (!Number.isFinite(length) || length <= 0) {
      return errorResponse(411, "Falta el tamaño del archivo")
    }
    if (length > MAX_MEDIA_BYTES) {
      return errorResponse(413, "El vídeo supera el máximo de 95 MB")
    }
    if (!req.body) return errorResponse(400, "Archivo vacío")

    try {
      await putMedia(key, contentType, req.body, length)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("too-large")) {
        return errorResponse(413, "El vídeo supera el máximo de 95 MB")
      }
      throw e
    }

    return Response.json({ ok: true, url: mediaUrl(key), bytes: length })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const key = new URL(req.url).searchParams.get("key") ?? ""
    if (!MEDIA_KEY_RE.test(key)) return errorResponse(400, "Clave de archivo inválida")
    await deleteMedia(key)
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

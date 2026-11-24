// ============================================================
// POST /api/uploader/token — Token corto de subida (miembros)
// ------------------------------------------------------------
// El muro necesita aceptar imágenes de MIEMBROS autenticados en
// el almacén de medios (R2, vía media worker). El worker no
// comparte la sesión de NextAuth, así que la app (que sí la
// conoce) emite un token HMAC de 10 min ligado a la clave:
//   t = HMAC(MEDIA_SIGNING_KEY, "up|{key}|{e}")
// El media worker lo verifica en PUT /api/media/member/upload.
// ============================================================

import { NextRequest } from "next/server"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { createUploadToken } from "@/lib/media-token"

const KEY_RE = /^posts\/[a-z0-9-]{6,64}\.(jpe?g|png|webp)$/

export async function POST(req: NextRequest) {
  try {
    await requireActiveUser()

    const body = ((await req.json().catch(() => null)) ?? {}) as { key?: string }
    const key = typeof body.key === "string" ? body.key : ""
    if (!KEY_RE.test(key)) return errorResponse(400, "Clave de subida inválida")

    const token = await createUploadToken(key)
    if (!token) {
      // Desarrollo local (sin clave de firma): el flujo local no
      // necesita token — el cliente usa la ruta local directamente.
      return Response.json({ dev: true, t: "", e: 0 })
    }
    return Response.json({ t: token.t, e: token.e })
  } catch (e) {
    return handleApiError(e)
  }
}

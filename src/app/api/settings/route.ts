// ============================================================
// /api/settings — lectura PÚBLICA de ajustes del hub por clave.
// El muro consulta ?key=muro_video para el vídeo del titular.
// Solo se exponen claves marcadas como públicas.
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { handleApiError } from "@/lib/api-helpers"
import { signMediaUrl } from "@/lib/media-token"

// Claves que el cliente puede leer sin ser admin
const PUBLIC_KEYS = new Set(["muro_video", "muro_video_poster"])

export async function GET(req: NextRequest) {
  try {
    const key = new URL(req.url).searchParams.get("key") ?? ""
    if (!PUBLIC_KEYS.has(key)) {
      return Response.json({ error: "Clave no disponible" }, { status: 403 })
    }
    const setting = await db.setting.findUnique({ where: { key } })
    const value =
      setting && setting.value.trim().length > 0 ? await signMediaUrl(setting.value) : null
    return Response.json({ key, value })
  } catch (e) {
    return handleApiError(e)
  }
}

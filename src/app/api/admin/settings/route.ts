// ============================================================
// /api/admin/settings — gestión de ajustes del hub (solo admin).
// GET → todos los ajustes (clave/valor)
// PUT → upsert de una clave (vídeo del muro, textos del titular…)
// DELETE → borrar una clave
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import { signMediaUrl } from "@/lib/media-token"

const MAX_VALUE = 2000 // caracteres por valor
// Las portadas de vídeo (dataURL 16:9 ~400 KB) necesitan más espacio
const POSTER_KEYS = new Set(["muro_video_poster"])
const MAX_POSTER_VALUE = 500_000

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const settings = await db.setting.findMany({ orderBy: { key: "asc" } })
    // El vídeo del muro se devuelve firmado (HMAC) para que el media
    // worker autentique la vista previa sin sesión Node.js.
    const out = await Promise.all(
      settings.map(async (s) => ({
        ...s,
        value: s.value.startsWith("/api/media/") ? await signMediaUrl(s.value) : s.value,
      }))
    )
    return Response.json({ settings: out })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const key = typeof body.key === "string" ? body.key.trim() : ""
    const value = typeof body.value === "string" ? body.value.trim() : ""

    if (!/^[\w.\-]{2,64}$/.test(key)) return errorResponse(400, "Clave inválida")
    if (POSTER_KEYS.has(key)) {
      // Portada del vídeo del muro: dataURL de imagen comprimida en cliente
      if (value && !value.startsWith("data:image/")) {
        return errorResponse(400, "La portada debe ser una imagen")
      }
      if (value.length > MAX_POSTER_VALUE) {
        return errorResponse(400, "La portada es demasiado grande (máx ~400 KB)")
      }
    } else if (value.length > MAX_VALUE) {
      return errorResponse(400, "El valor supera el máximo de 2000 caracteres")
    }

    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const key = new URL(req.url).searchParams.get("key") ?? ""
    if (!key) return errorResponse(400, "Falta la clave")
    await db.setting.deleteMany({ where: { key } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

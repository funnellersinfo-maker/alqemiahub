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

const MAX_VALUE = 2000 // caracteres por valor

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const settings = await db.setting.findMany({ orderBy: { key: "asc" } })
    return Response.json({ settings })
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
    if (value.length > MAX_VALUE) return errorResponse(400, "El valor supera el máximo de 2000 caracteres")

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

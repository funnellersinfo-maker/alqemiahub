// POST /api/admin/verify — Validar la clave del Panel Admin (comparación en tiempo constante)
import crypto from "crypto"
import { NextRequest } from "next/server"
import { ADMIN_KEY } from "@/lib/admin"
import { errorResponse, handleApiError } from "@/lib/api-helpers"

export async function POST(req: NextRequest) {
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const key = typeof body.key === "string" ? body.key : ""

    const a = Buffer.from(String(key))
    const b = Buffer.from(ADMIN_KEY)
    // timingSafeEqual lanza si las longitudes difieren → comprobar antes
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b)

    if (!ok) return errorResponse(401, "Clave incorrecta")
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

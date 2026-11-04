import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/password"
import { errorResponse, handleApiError } from "@/lib/api-helpers"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (name.length < 2) return errorResponse(400, "Ingresa tu nombre completo")
    if (name.length > 60) return errorResponse(400, "El nombre es demasiado largo")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse(400, "Ingresa un email válido")
    if (password.length < 6) return errorResponse(400, "La contraseña debe tener al menos 6 caracteres")

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return errorResponse(409, "Ese email ya está registrado. Inicia sesión.")

    await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        lastActiveAt: new Date(),
      },
    })

    return Response.json({ ok: true }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

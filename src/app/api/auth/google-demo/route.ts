import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { errorResponse, handleApiError } from "@/lib/api-helpers"

/**
 * Login simulado de Google (modo demo cuando no hay credenciales OAuth).
 * Crea o recupera la cuenta vinculada a `demo:<email>`; el login final
 * se hace con signIn("credentials", { email, mode: "google-demo" }).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""

    if (name.length < 2) return errorResponse(400, "Ingresa tu nombre")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse(400, "Ingresa un email válido")

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      if (existing.googleId) return Response.json({ ok: true, email })
      return errorResponse(409, "Ese email ya tiene cuenta con contraseña. Ingresa con tus datos.")
    }

    await db.user.create({
      data: {
        name,
        email,
        googleId: `demo:${email}`,
        lastActiveAt: new Date(),
      },
    })
    return Response.json({ ok: true, email }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

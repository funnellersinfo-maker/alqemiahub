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
    const inviteCode =
      typeof body.inviteCode === "string"
        ? body.inviteCode.toUpperCase().replace(/\s+/g, "")
        : ""

    if (name.length < 2) return errorResponse(400, "Ingresa tu nombre completo")
    if (name.length > 60) return errorResponse(400, "El nombre es demasiado largo")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse(400, "Ingresa un email válido")
    if (password.length < 6) return errorResponse(400, "La contraseña debe tener al menos 6 caracteres")
    if (!inviteCode) return errorResponse(400, "Ingresa tu código de invitación")

    // ---- Validación del sello de invitación ----
    const invite = await db.inviteCode.findUnique({ where: { code: inviteCode } })
    if (!invite) {
      return errorResponse(400, "Ese código de invitación no existe. Revisa con quien te invitó.")
    }
    if (invite.usedAt) {
      return errorResponse(400, "Ese código ya fue usado. Cada código funciona una sola vez.")
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return errorResponse(400, "Esa invitación expiró. Pide una nueva a quien te invitó.")
    }
    if (invite.email !== email) {
      return errorResponse(400, "Ese código fue emitido para otro correo. Regístrate con el correo de tu invitación.")
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return errorResponse(409, "Ese email ya está registrado. Inicia sesión.")

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        lastActiveAt: new Date(),
      },
    })

    // La invitación queda sellada: un código, un uso, para siempre
    await db.inviteCode.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedById: user.id },
    })

    return Response.json({ ok: true }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

// ============================================================
// GET / POST / PATCH / DELETE /api/admin/invites
// Códigos de invitación únicos: el titular los genera desde el
// panel ingresando el correo con el que el prospecto se va a
// registrar. Correo y código deben coincidir al registrarse.
// Protegido: header x-admin-key o sesión con rol ADMIN.
// ============================================================

import { NextRequest } from "next/server"
import crypto from "crypto"
import { getServerSession } from "next-auth"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { authOptions } from "@/lib/auth"
import { errorResponse, handleApiError } from "@/lib/api-helpers"
import type { InviteDTO, InviteStatus } from "@/lib/types"

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I, 8/B...)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomCode(): string {
  const bytes = crypto.randomBytes(8)
  let raw = ""
  for (let i = 0; i < 8; i++) {
    raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return `ALQ-${raw.slice(0, 4)}-${raw.slice(4)}`
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const clash = await db.inviteCode.findUnique({ where: { code } })
    if (!clash) return code
  }
  // Probabilidad ínfima; último recurso con más entropía
  return `${randomCode()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`
}

function inviteStatus(i: {
  usedAt: Date | null
  expiresAt: Date | null
}): InviteStatus {
  if (i.usedAt) return "USED"
  if (i.expiresAt && i.expiresAt.getTime() < Date.now()) return "EXPIRED"
  return "PENDING"
}

function toDTO(i: {
  id: string
  code: string
  email: string
  note: string | null
  usedAt: Date | null
  usedById: string | null
  expiresAt: Date | null
  createdAt: Date
}): InviteDTO {
  return {
    id: i.id,
    code: i.code,
    email: i.email,
    note: i.note,
    status: inviteStatus(i),
    createdAt: i.createdAt.toISOString(),
    usedAt: i.usedAt ? i.usedAt.toISOString() : null,
    usedBy: i.usedAt ? i.email : null,
    expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
  }
}

/** Id del titular que opera (sesión ADMIN o la clave maestra). */
async function resolveActorId(): Promise<string> {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) return String(session.user.id)
  } catch {
    // sin sesión → clave maestra
  }
  return "titular"
}

// ---------------- GET: listar ----------------
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const invites = await db.inviteCode.findMany({ orderBy: { createdAt: "desc" } })
    return Response.json({ invites: invites.map(toDTO) })
  } catch (e) {
    return handleApiError(e)
  }
}

// ---------------- POST: generar ----------------
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(400, "Ingresa un correo válido")
    }

    // Un correo = una invitación viva
    const existing = await db.inviteCode.findUnique({ where: { email } })
    if (existing) {
      if (existing.usedAt) {
        return errorResponse(409, "Ese correo ya usó su invitación y está registrado")
      }
      return errorResponse(409, "Ya existe una invitación pendiente para ese correo. Regénérala desde la lista.")
    }

    const createdBy = await resolveActorId()
    const created = await db.inviteCode.create({
      data: { code: await generateUniqueCode(), email, note, createdBy },
    })
    return Response.json({ invite: toDTO(created) }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

// ---------------- PATCH: regenerar código (solo pendientes) ----------------
export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const body = await req.json().catch(() => ({}))
    const id = typeof body.id === "string" ? body.id : ""

    const invite = await db.inviteCode.findUnique({ where: { id } })
    if (!invite) return errorResponse(404, "Invitación no encontrada")
    if (invite.usedAt) return errorResponse(400, "Esa invitación ya fue usada")

    const updated = await db.inviteCode.update({
      where: { id },
      data: { code: await generateUniqueCode() },
    })
    return Response.json({ invite: toDTO(updated) })
  } catch (e) {
    return handleApiError(e)
  }
}

// ---------------- DELETE: eliminar ----------------
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const body = await req.json().catch(() => ({}))
    const id = typeof body.id === "string" ? body.id : ""

    const invite = await db.inviteCode.findUnique({ where: { id } })
    if (!invite) return errorResponse(404, "Invitación no encontrada")

    await db.inviteCode.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

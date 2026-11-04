// Helpers compartidos por las rutas API

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status })
}

export function handleApiError(e: unknown) {
  if (e instanceof ApiError) {
    return errorResponse(e.status, e.message)
  }
  console.error("[api] Error interno:", e)
  return errorResponse(500, "Error interno. Intenta de nuevo.")
}

/** Usuario de la sesión con datos frescos de la BD, o null */
export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  const id = session?.user?.id
  if (!id) return null
  return db.user.findUnique({ where: { id } })
}

/** Exige sesión activa; lanza 401 */
export async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, "No autenticado")
  return user
}

/** Exige sesión activa y usuario no bloqueado; lanza 401/403 */
export async function requireActiveUser() {
  const user = await requireUser()
  if (user.status === "BLOCKED") {
    throw new ApiError(403, "Tu cuenta está suspendida. Contacta al equipo ALQEMIRA.")
  }
  return user
}

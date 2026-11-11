// ============================================================
// ALQEMIA HUB — Acceso al Panel Admin
// Dos vías de acceso:
//   1) Clave secreta (la tuerca del menú) → header x-admin-key
//   2) Usuario autenticado con rol ADMIN (admin@alqemia.com)
// ============================================================

import crypto from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export const ADMIN_KEY = process.env.ADMIN_ACCESS_KEY ?? "ALQEMIA-ADMIN-2025"

function isKeyValid(key: string | null): boolean {
  if (!key) return false
  const a = Buffer.from(key)
  const b = Buffer.from(ADMIN_KEY)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** true si la petición trae la clave correcta O el usuario de la sesión es ADMIN */
export async function isAdminRequest(req: Request): Promise<boolean> {
  if (isKeyValid(req.headers.get("x-admin-key"))) return true
  try {
    const session = await getServerSession(authOptions)
    const id = session?.user?.id
    if (id) {
      const user = await db.user.findUnique({ where: { id } })
      if (user?.role === "ADMIN") return true
    }
  } catch {
    // Sin sesión válida → solo la clave otorga acceso
  }
  return false
}

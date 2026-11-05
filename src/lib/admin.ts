// ============================================================
// ALQEMIRA HUB — Acceso al Panel Admin mediante clave secreta
// (la tuerca del menú sandwich). Las rutas admin requieren el
// header x-admin-key con la clave correcta.
// ============================================================

import crypto from "crypto"

export const ADMIN_KEY = process.env.ADMIN_ACCESS_KEY ?? "ALQEMIRA-2025"

export function isAdminRequest(req: Request): boolean {
  const key = req.headers.get("x-admin-key")
  if (!key) return false
  const a = Buffer.from(key)
  const b = Buffer.from(ADMIN_KEY)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

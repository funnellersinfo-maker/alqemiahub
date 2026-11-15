// ============================================================
// ALQEMIA HUB — Verificación de cuentas (helper compartido)
// Cuenta verificada = chulito azul otorgado por el titular,
// rol admin, o rango de Gran Maestre (2400+ XP, nivel 7).
// ============================================================

/** Determina si un usuario muestra el sello de cuenta verificada. */
export function isVerifiedUser(user: {
  verified?: boolean | null
  role?: string | null
  xp?: number | null
}): boolean {
  return user.verified === true || user.role === "ADMIN" || (user.xp ?? 0) >= 2400
}

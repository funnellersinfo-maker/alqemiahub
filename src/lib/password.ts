// Hash de contraseñas con scrypt (node:crypto, sin dependencias externas)

import crypto from "crypto"

const KEY_LEN = 64

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString("hex")
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split(":")
    if (scheme !== "scrypt" || !salt || !hash) return false
    const test = crypto.scryptSync(password, salt, KEY_LEN)
    return crypto.timingSafeEqual(Buffer.from(test.toString("hex"), "hex"), Buffer.from(hash, "hex"))
  } catch {
    return false
  }
}

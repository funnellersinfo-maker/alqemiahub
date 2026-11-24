// ============================================================
// MEDIA TOKEN — Firma de enlaces de vídeo para el media worker
// ------------------------------------------------------------
// Los vídeos se sirven (producción) desde el worker de relé
// alqemia-media (workerd puro) a través del portal, NO desde
// OpenNext/Node.js (que excedía el límite de CPU con vídeos
// grandes → Error 1102). Ese worker autentica cada petición
// con un enlace firmado HMAC-SHA256 que esta utilidad añade a
// las URLs internas /api/media/... en el momento en que la API
// las devuelve al cliente:
//
//     /api/media/lessons/x.mp4?e=<caducidad>&s=<firma>
//
// Sin firma (desarrollo local, sin Cloudflare) la URL se
// devuelve tal cual — la ruta /api/media clásica sirve desde
// disco y no requiere token.
// ============================================================

import { getCloudflareContext } from "@opennextjs/cloudflare"

/** Vida útil del enlace: 7 días (rota en cada carga de datos). */
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

type CfEnvLike = { MEDIA_SIGNING_KEY?: string }

function resolveSigningKey(): string | null {
  const manual = (
    globalThis as unknown as { __ALQEMIA_CF_ENV__?: CfEnvLike }
  ).__ALQEMIA_CF_ENV__?.MEDIA_SIGNING_KEY
  if (manual) return manual
  try {
    const ctx = getCloudflareContext() as { env?: CfEnvLike } | null
    if (ctx?.env?.MEDIA_SIGNING_KEY) return ctx.env.MEDIA_SIGNING_KEY
  } catch {
    // Sin contexto de Cloudflare (desarrollo local / build) → sin firma
  }
  return null
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  let hex = ""
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0")
  return hex
}

/**
 * Añade ?e=&s= a una URL interna de medios (no-op con URLs externas
 * o cuando no hay clave de firma — desarrollo local). null → null.
 */
export async function signMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  if (!url.startsWith("/api/media/")) return url
  const secret = resolveSigningKey()
  if (!secret) return url
  const key = url.slice("/api/media/".length)
  const e = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const s = await hmacHex(secret, `${key}|${e}`)
  return `${url}?e=${e}&s=${s}`
}

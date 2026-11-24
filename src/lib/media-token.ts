// ============================================================
// MEDIA TOKEN — Firma de enlaces y tokens de subida
// ------------------------------------------------------------
// REPRODUCCIÓN (/api/media/…): enlace firmado HMAC-SHA256 que el
// media worker (alqemia-media, sobre R2) valida sin sesión.
//
//   NOVEDAD v2 — VENTANA ESTABLE: la caducidad se redondea a
//   ventanas de 30 días → la misma clave produce LA MISMA URL
//   durante semanas → el navegador, la CDN y la Bóveda Offline
//   pueden cachear. (Antes la firma rotaba en cada carga y
//   rompía cualquier caché → vídeos lentos SIEMPRE.)
//
// SUBIDA DE MIEMBROS: token corto (10 min) firmado por la app
// que permite al media worker aceptar la imagen del muro de un
// miembro autenticado (POST /api/uploader/token).
// ============================================================

import { getCloudflareContext } from "@opennextjs/cloudflare"

/** Ventana estable: 30 días (la URL no cambia dentro de la ventana). */
const WINDOW_SECONDS = 30 * 24 * 60 * 60
/** Validez siempre ≥ 30 días y ≤ 60 días tras la firma. */
const TOKEN_TTL_SECONDS = 2 * WINDOW_SECONDS
/** Tokens de subida de miembros: 10 minutos. */
const UPLOAD_TOKEN_TTL = 600

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
 * Limpia firmas viejas para no acumular query strings.
 */
export async function signMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  if (!url.startsWith("/api/media/")) return url
  const secret = resolveSigningKey()
  if (!secret) return url
  const clean = url.split("?")[0]
  const key = clean.slice("/api/media/".length)
  // Ventana estable: misma e (y misma firma) durante 30 días
  const e = (Math.floor(Date.now() / 1000 / WINDOW_SECONDS) + 2) * WINDOW_SECONDS
  const s = await hmacHex(secret, `${key}|${e}`)
  return `${clean}?e=${e}&s=${s}`
}

/**
 * Token de subida corto para miembros (imágenes del muro).
 * Lo verifica el media worker contra `up|{key}|{e}`.
 */
export async function createUploadToken(key: string): Promise<{ t: string; e: number } | null> {
  const secret = resolveSigningKey()
  if (!secret) return null
  const e = Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_TTL
  const t = await hmacHex(secret, `up|${key}|${e}`)
  return { t, e }
}

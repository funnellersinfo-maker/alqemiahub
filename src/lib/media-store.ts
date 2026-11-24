// ============================================================
// MEDIA STORE — Almacenamiento de medios (multi-entorno)
//   · Cloudflare (producción): el worker alqemia-media sirve y
//     sube todo desde R2 a través del portal — este módulo
//     queda como vía de LEGADO (vídeos antiguos en el DO) y
//     como almacén local de DESARROLLO (.data/media).
//   · Local / sandbox: archivos en disco (.data/media).
// ============================================================

import { getCloudflareContext } from "@opennextjs/cloudflare"

/** Tope por archivo en la vía de subida antigua (un solo PUT). */
export const MAX_MEDIA_BYTES = 95 * 1024 * 1024
/**
 * Claves válidas:
 *   · Vídeos: muro/muro-video(-v{n}).{mp4|webm|mov} y lessons/{id}.{ext}
 *   · Imágenes: muro/muro-poster(-v{n}), posters/{id}, posts/{id}
 */
export const MEDIA_KEY_RE = new RegExp(
  [
    "^(muro/muro-video(-v\\d{1,15})?|lessons/[a-z0-9-]{6,64})\\.(mp4|webm|mov)$",
    "^(muro/muro-poster(-v\\d{1,15})?|posters/[a-z0-9-]{6,64}|posts/[a-z0-9-]{6,64})\\.(jpe?g|png|webp)$",
  ].join("|")
)

/** URL pública con la que se sirve un medio (ruta de la app). */
export const mediaUrl = (key: string) => `/api/media/${key}`

// ------------------------------------------------------------
// Namespace del Durable Object (legado) + service binding MEDIA
// ------------------------------------------------------------

type MediaStub = { fetch: (input: string, init?: RequestInit) => Promise<Response> }
type MediaNamespace = {
  idFromName: (name: string) => unknown
  get: (id: unknown) => MediaStub
}
type MediaService = { fetch: (input: string, init?: RequestInit) => Promise<Response> }

function getMediaNamespace(): MediaNamespace | null {
  const manual = (globalThis as unknown as { __ALQEMIA_CF_ENV__?: { HUB_DB?: MediaNamespace } })
    .__ALQEMIA_CF_ENV__?.HUB_DB
  if (manual) return manual
  try {
    const ctx = getCloudflareContext() as { env?: { HUB_DB?: MediaNamespace } } | null
    if (ctx?.env?.HUB_DB) return ctx.env.HUB_DB
  } catch {
    // Sin contexto de Cloudflare (desarrollo local / build)
  }
  return null
}

/** Service binding al worker alqemia-media (borrados desde el servidor). */
function getMediaService(): MediaService | null {
  const manual = (globalThis as unknown as { __ALQEMIA_CF_ENV__?: { MEDIA?: MediaService } })
    .__ALQEMIA_CF_ENV__?.MEDIA
  if (manual) return manual
  try {
    const ctx = getCloudflareContext() as { env?: { MEDIA?: MediaService } } | null
    if (ctx?.env?.MEDIA) return ctx.env.MEDIA
  } catch {
    // Sin contexto de Cloudflare (desarrollo local / build)
  }
  return null
}

function mediaDoFetch(key: string, init?: RequestInit): Promise<Response> {
  const ns = getMediaNamespace()
  if (!ns) throw new Error("no-media-namespace")
  const stub = ns.get(ns.idFromName("primary"))
  return stub.fetch(`https://hub-db/media/${key}`, init)
}

// ------------------------------------------------------------
// FixedLengthStream — global del runtime de Cloudflare Workers.
// Al construir una Response con un stream de longitud desconocida,
// el runtime DESCARTA el encabezado Content-Length. Sin él, la
// caché multimedia del navegador no puede reutilizar respuestas y
// la reproducción repetida del vídeo se rompe. FixedLengthStream
// declara el tamaño exacto para que el encabezado se respete.
// ------------------------------------------------------------

type FixedLengthPair = {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<Uint8Array>
}
declare const FixedLengthStream: { new (expectedLength: number): FixedLengthPair }

/** Envuelve la respuesta del DO para conservar su Content-Length real. */
function withFixedLength(res: Response): Response {
  const len = res.headers.get("content-length")
  const n = len ? Number(len) : NaN
  if (!res.body || !Number.isFinite(n) || n < 0) return res
  if (typeof FixedLengthStream === "undefined") return res // dev local (Node)
  try {
    const fls = new FixedLengthStream(n)
    void res.body.pipeTo(fls.writable).catch(() => {})
    const out = new Response(fls.readable, res)
    out.headers.set("content-length", len as string)
    return out
  } catch {
    return res
  }
}

// ------------------------------------------------------------
// Desarrollo local — archivos en disco
// ------------------------------------------------------------

async function localMediaPath(key: string): Promise<string> {
  const { join } = await import("node:path")
  return join(process.cwd(), ".data", "media", ...key.split("/"))
}

/** Parsea una cabecera Range de bytes. null = sin rango, "invalid" = 416. */
function parseRangeHeader(
  header: string | null,
  size: number
): { start: number; end: number } | null | "invalid" {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === "" && m[2] === "")) return "invalid"
  let start: number
  let end: number
  if (m[1] === "") {
    const suffix = Number(m[2])
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid"
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    if (!Number.isFinite(start) || start < 0) return "invalid"
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start > end || start >= size) return "invalid"
  return { start, end }
}

function contentTypeForKey(key: string): string {
  if (key.endsWith(".webm")) return "video/webm"
  if (key.endsWith(".mov")) return "video/quicktime"
  if (key.endsWith(".mp4")) return "video/mp4"
  if (key.endsWith(".png")) return "image/png"
  if (key.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

// ------------------------------------------------------------
// API pública del almacén (vía legado / desarrollo)
// ------------------------------------------------------------

/**
 * Guarda un vídeo (streaming, sin buffer completo en memoria).
 * Vía ANTIGUA: en producción las subidas van por trozos al
 * worker alqemia-media (R2); esto queda para desarrollo local.
 * Lanza Error("too-large") si supera el tope.
 */
export async function putMedia(
  key: string,
  contentType: string,
  body: ReadableStream<Uint8Array>,
  contentLength: number
): Promise<void> {
  const ns = getMediaNamespace()
  if (ns) {
    const res = await mediaDoFetch(key, {
      method: "PUT",
      headers: {
        "content-type": contentType,
        "content-length": String(contentLength),
      },
      body,
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? `media-put-${res.status}`)
    }
    return
  }

  // ---------- Desarrollo: archivo local ----------
  const { createWriteStream } = await import("node:fs")
  const { mkdir, unlink } = await import("node:fs/promises")
  const { Readable } = await import("node:stream")
  const { dirname } = await import("node:path")
  const filePath = await localMediaPath(key)
  await mkdir(dirname(filePath), { recursive: true })

  try {
    await new Promise<void>((resolve, reject) => {
      let total = 0
      let settled = false
      const fail = (err: Error) => {
        if (settled) return
        settled = true
        reject(err)
      }
      const nodeStream = Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream)
      const out = createWriteStream(filePath)
      nodeStream.on("data", (c: Buffer) => {
        total += c.length
        if (total > MAX_MEDIA_BYTES) {
          nodeStream.destroy()
          out.destroy()
          fail(new Error("too-large"))
        }
      })
      nodeStream.on("error", fail)
      out.on("error", fail)
      out.on("finish", () => {
        if (!settled) {
          settled = true
          resolve()
        }
      })
      nodeStream.pipe(out)
    })
  } catch (e) {
    await unlink(filePath).catch(() => {})
    throw e
  }
}

/**
 * Responde un medio con soporte de Range (200 / 206 / 404 / 416).
 * La respuesta se transmite en streaming (nunca se buferea entera).
 */
export async function getMediaResponse(key: string, rangeHeader: string | null): Promise<Response> {
  const ns = getMediaNamespace()
  if (ns) {
    const headers: Record<string, string> = {}
    if (rangeHeader) headers.range = rangeHeader
    // FixedLengthStream → el Content-Length sobrevive hasta el navegador
    const res = await mediaDoFetch(key, { headers })
    return withFixedLength(res)
  }

  // ---------- Desarrollo: archivo local ----------
  const { createReadStream } = await import("node:fs")
  const { stat } = await import("node:fs/promises")
  const { Readable } = await import("node:stream")
  const filePath = await localMediaPath(key)

  let size: number
  try {
    size = (await stat(filePath)).size
  } catch {
    return new Response("Not found", { status: 404 })
  }

  const range = parseRangeHeader(rangeHeader, size)
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        "content-range": `bytes */${size}`,
        "accept-ranges": "bytes",
      },
    })
  }

  const start = range ? range.start : 0
  const end = range ? range.end : size - 1
  const headers: Record<string, string> = {
    "content-type": contentTypeForKey(key),
    "accept-ranges": "bytes",
    "content-length": String(end - start + 1),
    // El 206 parcial nunca se cachea (rompe la reproducción repetida);
    // el 200 completo sí puede reutilizarse una hora.
    "cache-control": range ? "private, no-store" : "private, max-age=3600",
  }
  if (range) headers["content-range"] = `bytes ${start}-${end}/${size}`

  const nodeStream = createReadStream(filePath, { start, end })
  const stream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
  return new Response(stream, { status: range ? 206 : 200, headers })
}

/**
 * Elimina un medio (si existe). En producción lo borra el worker
 * alqemia-media vía service binding (R2 + legado DO); en desarrollo
 * borra el archivo local.
 */
export async function deleteMedia(key: string): Promise<void> {
  const service = getMediaService()
  if (service) {
    const res = await service.fetch(
      `https://alqemia-media/api/media/admin/delete?key=${encodeURIComponent(key)}`,
      {
        method: "DELETE",
        headers: { "x-admin-key": process.env.ADMIN_ACCESS_KEY ?? "ALQEMIA-ADMIN-2025" },
      }
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(`media-delete-${res.status}`)
    }
    return
  }
  const ns = getMediaNamespace()
  if (ns) {
    const res = await mediaDoFetch(key, { method: "DELETE" })
    if (!res.ok && res.status !== 404) {
      throw new Error(`media-delete-${res.status}`)
    }
    return
  }
  const { unlink } = await import("node:fs/promises")
  await unlink(await localMediaPath(key)).catch(() => {})
}

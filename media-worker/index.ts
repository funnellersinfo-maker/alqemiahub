// ============================================================
// ALQEMIA MEDIA v2.1 — Worker de medios sobre el DO + CDN de borde
// ------------------------------------------------------------
// ARQUITECTURA DEFINITIVA (sin depender de servicios de pago):
//   · ANTES: cada reproducción atravesaba el Durable Object único
//     (trozos de 1 MiB en SQLite), la firma de la URL rotaba en
//     cada carga (rompía toda caché) y no había ninguna caché de
//     CDN → vídeo lento, se caía, "pegado".
//   · AHORA:
//     1) FIRMA ESTABLE: la misma URL durante ventanas de 30 días
//        → el navegador y la CDN pueden cachear.
//     2) CACHÉ DE BORDE (caches.default en cada colo): la primera
//        carga de cada vídeo se copia ENTERA a la caché del borde
//        más cercano al usuario (Bogotá/LatAm). Las siguientes
//        cargas completas salen de la CDN → instantáneas, HD fluido,
//        sin importar la señal.
//     3) SUBIDA POR TROCES de 8 MB (begin → part → complete) hacia
//        el DO → sin límite de 100 MB por petición → hasta 1,5 GB.
//     4) BÚVEDA OFFLINE (Service Worker) en los miembros que
//        descargan: reproducción local sin internet.
//   · Las búsquedas (seek) leen SOLO los trozos pedidos del DO
//     (lecturas puntuales de 1 MiB → rápidas).
//
// Autenticación:
//   · Reproducción: enlace firmado HMAC (?e=&s=), ventana 30 días.
//   · Admin: header x-admin-key.
//   · Miembros: token de subida corto (firmado por la app).
//
// Rutas (todo bajo /api/media/* — el portal enruta aquí):
//   GET/HEAD  /api/media/<key>?e=..&s=..      → 200 (CDN) / 206 / 404 / 416
//   POST      /api/media/admin/upload-begin    {key, contentType, size}
//   PUT       /api/media/admin/upload-part?uploadId=..&n=..  (cuerpo = trozo)
//   POST      /api/media/admin/upload-complete {uploadId, key, parts}
//   POST      /api/media/admin/upload-abort    {uploadId, key}
//   PUT       /api/media/admin/put?key=..      (imágenes pequeñas)
//   DELETE    /api/media/admin/delete?key=..
//   PUT       /api/media/member/upload?key=..&t=..&e=..
//   GET       /health
// ============================================================

interface Env {
  HUB_DB: DurableObjectNamespace
  MEDIA_SIGNING_KEY?: string
  ADMIN_ACCESS_KEY?: string
}

// ---------- Validación de claves ----------

/** Vídeo del muro (versionado: cada subida es una clave nueva) */
const MURO_VIDEO_RE = /^muro\/muro-video(-v\d{1,15})?\.(mp4|webm|mov)$/
/** Lección (clave única por subida — contenido inmutable) */
const LESSON_RE = /^lessons\/[a-z0-9-]{6,64}\.(mp4|webm|mov)$/
/** Portadas e imágenes (admin: posters/ y muro; miembros: posts/) */
const IMAGE_RE =
  /^(muro\/muro-poster(-v\d{1,15})?|posters\/[a-z0-9-]{6,64}|posts\/[a-z0-9-]{6,64})\.(jpe?g|png|webp)$/

const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024 * 1024 // 1,5 GB por archivo
const MAX_PUT_BYTES = 3 * 1024 * 1024 // 3 MB de una vez (imágenes)
const MAX_PART_BYTES = 16 * 1024 * 1024
/** Objetos mayores no se copian a la caché del borde (límite CF ~512 MB). */
const MAX_CACHEABLE_BYTES = 400 * 1024 * 1024
const VIDEO_TYPES = /^video\/(mp4|webm|quicktime)(;.*)?$/i
const IMAGE_TYPES = /^image\/(jpe?g|png|webp)(;.*)?$/i

function keyIsVideo(key: string): boolean {
  return MURO_VIDEO_RE.test(key) || LESSON_RE.test(key)
}
function keyIsImage(key: string): boolean {
  return IMAGE_RE.test(key)
}
function keyKnown(key: string): boolean {
  return keyIsVideo(key) || keyIsImage(key)
}

// ---------- Utilidades ----------

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
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

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Autenticación admin por header x-admin-key (comparación en tiempo ~constante). */
function isAdmin(req: Request, env: Env): boolean {
  const expected = env.ADMIN_ACCESS_KEY ?? ""
  const given = req.headers.get("x-admin-key") ?? ""
  if (expected.length === 0 || expected.length !== given.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  }
  return diff === 0
}

/** Parsea una cabecera Range de bytes → {start,end} | null | "invalid". */
function parseRange(
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

type FixedLengthPair = {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<Uint8Array>
}
declare const FixedLengthStream: { new (expectedLength: number): FixedLengthPair }

/** Envuelve una respuesta para conservar su Content-Length real. */
function withFixedLength(res: Response): Response {
  const len = res.headers.get("content-length")
  const n = len ? Number(len) : NaN
  if (!res.body || !Number.isFinite(n) || n < 0) return res
  if (typeof FixedLengthStream === "undefined") return res
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

// ---------- DO (origen) ----------

function mediaStub(env: Env): DurableObjectStub {
  return env.HUB_DB.get(env.HUB_DB.idFromName("primary"))
}

function relayToDO(
  env: Env,
  key: string,
  rangeHeader: string | null,
  method?: string
): Promise<Response> {
  const headers = new Headers()
  if (rangeHeader) headers.set("range", rangeHeader)
  return mediaStub(env).fetch(`https://hub-db/media/${key}`, {
    method: method ?? "GET",
    headers,
  })
}

// ---------- Enlace firmado (ventana estable de 30 días) ----------

const WINDOW_SECONDS = 30 * 24 * 60 * 60

async function signLink(env: Env, key: string): Promise<string> {
  const secret = env.MEDIA_SIGNING_KEY
  if (!secret) return `/api/media/${key}`
  const e = (Math.floor(Date.now() / 1000 / WINDOW_SECONDS) + 2) * WINDOW_SECONDS
  const s = await hmacHex(secret, `${key}|${e}`)
  return `/api/media/${key}?e=${e}&s=${s}`
}

async function verifyLink(env: Env, key: string, url: URL): Promise<boolean> {
  const secret = env.MEDIA_SIGNING_KEY
  if (!secret) return false
  const e = url.searchParams.get("e")
  const s = url.searchParams.get("s")
  if (!e || !s || !/^[a-f0-9]{64}$/.test(s)) return false
  const exp = Number(e)
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) >= exp) return false
  const expected = await hmacHex(secret, `${key}|${e}`)
  return safeEqualHex(expected, s)
}

// ---------- Caché de borde (CDN del colo) ----------

/**
 * Clave de caché sintética por vídeo (NO se enruta: solo identifica
 * la copia completa dentro de caches.default del colo actual).
 */
function cacheRequestFor(key: string): Request {
  return new Request(`https://alqemia-media.local/__vault/${key}`, { method: "GET" })
}

/** Marca la copia como cacheable por un año (contenido inmutable por clave). */
function cacheableCopy(res: Response, size: number): Response {
  const headers = new Headers(res.headers)
  headers.set("cache-control", "public, max-age=31536000, immutable")
  headers.set("accept-ranges", "bytes")
  headers.set("content-length", String(size))
  headers.set("etag", `"${size}"`)
  const out = new Response(res.body, { status: 200, headers })
  return withFixedLength(out)
}

/** Copia el vídeo COMPLETO del DO a la caché del borde (una vez por colo). */
async function warmEdgeCache(env: Env, key: string): Promise<void> {
  const cache = caches.default
  const cacheReq = cacheRequestFor(key)
  const hit = await cache.match(cacheReq)
  if (hit) return
  // Tamaño declarado: solo cachear objetos razonables
  const head = await relayToDO(env, key, null, "HEAD")
  if (!head.ok) return
  const size = Number(head.headers.get("content-length") ?? "0")
  if (!Number.isFinite(size) || size <= 0 || size > MAX_CACHEABLE_BYTES) return
  const full = await relayToDO(env, key, null)
  if (!full.ok || !full.body) return
  await cache.put(cacheReq, cacheableCopy(full, size))
}

// ---------- Reproducción ----------

async function serveMedia(
  env: Env,
  ctx: ExecutionContext | null,
  key: string,
  req: Request,
  rangeHeader: string | null
): Promise<Response> {
  const cache = caches.default
  const cacheReq = cacheRequestFor(key)

  // ---- HEAD: metadatos directos del DO ----
  if (rangeHeader === "__HEAD__") {
    return relayToDO(env, key, null, "HEAD")
  }

  const range = rangeHeader ? parseRange(rangeHeader, Number.MAX_SAFE_INTEGER) : null
  const openFromZero =
    range !== null &&
    range !== "invalid" &&
    (range as { start: number }).start === 0 &&
    rangeHeader?.trim() === "bytes=0-"

  // ---- Carga completa (sin Range o "bytes=0-") → CACHÉ DE BORDE ----
  // El reproductor recibe el archivo entero desde la CDN del colo:
  // velocidad de borde, HD fluido, sin rotación de firma.
  if (!rangeHeader || openFromZero) {
    const hit = await cache.match(cacheReq)
    if (hit) return hit
    // Tamaño real primero (para decidir si es cacheable)
    const head = await relayToDO(env, key, null, "HEAD")
    if (!head.ok) return head // 404 del DO
    const size = Number(head.headers.get("content-length") ?? "0")
    const full = await relayToDO(env, key, null)
    if (!full.ok || !full.body) return json(404, { ok: false, error: "not-found" })
    const out = cacheableCopy(full, size)
    if (ctx && size > 0 && size <= MAX_CACHEABLE_BYTES) {
      // Guardar una copia en la caché del borde para las próximas cargas.
      // El recheck descarta el caso en que el medio fue borrado mientras
      // la lectura estaba en vuelo.
      ctx.waitUntil(
        (async () => {
          try {
            const recheck = await relayToDO(env, key, null, "HEAD")
            if (!recheck.ok) return
            const again = await relayToDO(env, key, null)
            if (again.ok && again.body) {
              await cache.put(cacheReq, cacheableCopy(again, size))
            }
          } catch {
            /* la próxima carga lo intenta de nuevo */
          }
        })()
      )
    }
    return out
  }

  // ---- Seek / rango acotado → lectura puntual del DO (rápida:
  // solo los trozos pedidos) + calentar la caché en segundo plano ----
  const res = await relayToDO(env, key, rangeHeader)
  if (res.status !== 404 && ctx) {
    ctx.waitUntil(warmEdgeCache(env, key).catch(() => {}))
  }
  return res
}

// ---------- Subida por trozos (DO append) ----------

async function handleUploadBegin(req: Request, env: Env): Promise<Response> {
  if (!isAdmin(req, env)) return json(401, { ok: false, error: "not-authorized" })
  const body = (await req.json().catch(() => null)) as
    | { key?: string; contentType?: string; size?: number }
    | null
  const key = typeof body?.key === "string" ? body.key : ""
  const contentType = typeof body?.contentType === "string" ? body.contentType : ""
  const size = typeof body?.size === "number" ? body.size : 0

  if (!keyKnown(key)) return json(400, { ok: false, error: "invalid-key" })
  if (!VIDEO_TYPES.test(contentType) && !IMAGE_TYPES.test(contentType)) {
    return json(415, { ok: false, error: "unsupported-type" })
  }
  if (!Number.isFinite(size) || size <= 0) return json(400, { ok: false, error: "invalid-size" })
  if (size > MAX_UPLOAD_BYTES) {
    return json(413, { ok: false, error: "too-large", maxBytes: MAX_UPLOAD_BYTES })
  }

  const res = await mediaStub(env).fetch(`https://hub-db/media-begin/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType, size }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) return json(res.status, { ok: false, error: data.error ?? `begin-${res.status}` })
  return json(200, { ok: true, uploadId: key, chunkHint: 8 * 1024 * 1024 })
}

async function handleUploadPart(req: Request, env: Env): Promise<Response> {
  if (!isAdmin(req, env)) return json(401, { ok: false, error: "not-authorized" })
  const url = new URL(req.url)
  const key = url.searchParams.get("key") ?? ""
  const n = Number(url.searchParams.get("n") ?? "0")
  if (!keyKnown(key)) return json(400, { ok: false, error: "invalid-key" })
  if (!Number.isInteger(n) || n < 1 || n > 10000) return json(400, { ok: false, error: "invalid-part" })
  if (!req.body) return json(400, { ok: false, error: "empty-part" })

  const buf = await req.arrayBuffer()
  if (buf.byteLength === 0) return json(400, { ok: false, error: "empty-part" })
  if (buf.byteLength > MAX_PART_BYTES) return json(413, { ok: false, error: "part-too-large" })

  const res = await mediaStub(env).fetch(`https://hub-db/media-part/${key}`, {
    method: "PUT",
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(buf.byteLength),
    },
    body: buf,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; partBytes?: number }
  if (!res.ok) return json(res.status, { ok: false, error: data.error ?? `part-${res.status}` })
  // ETag sintético: el DO ensambla por secuencia, no lo necesita
  return json(200, { ok: true, etag: `part-${n}-${data.partBytes ?? 0}`, partNumber: n })
}

async function handleUploadComplete(req: Request, env: Env): Promise<Response> {
  if (!isAdmin(req, env)) return json(401, { ok: false, error: "not-authorized" })
  const body = (await req.json().catch(() => null)) as { uploadId?: string; key?: string } | null
  const key = typeof body?.key === "string" ? body.key : ""
  if (!keyKnown(key)) return json(400, { ok: false, error: "invalid-request" })

  const res = await mediaStub(env).fetch(`https://hub-db/media-complete/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; bytes?: number }
  if (!res.ok) return json(res.status, { ok: false, error: data.error ?? `complete-${res.status}` })
  const signed = await signLink(env, key)
  return json(200, {
    ok: true,
    url: `/api/media/${key}`,
    signed,
    bytes: data.bytes ?? 0,
  })
}

async function handleUploadAbort(req: Request, env: Env): Promise<Response> {
  if (!isAdmin(req, env)) return json(401, { ok: false, error: "not-authorized" })
  const body = (await req.json().catch(() => null)) as { key?: string } | null
  const key = typeof body?.key === "string" ? body.key : ""
  if (!keyKnown(key)) return json(400, { ok: false, error: "invalid-request" })
  const res = await mediaStub(env).fetch(`https://hub-db/media-abort/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  })
  if (!res.ok) return json(res.status, { ok: false, error: `abort-${res.status}` })
  return json(200, { ok: true })
}

// ---------- Subida pequeña de una vez (imágenes) ----------

async function putSmallFile(
  env: Env,
  key: string,
  buf: ArrayBuffer,
  contentType: string
): Promise<Response> {
  const res = await mediaStub(env).fetch(`https://hub-db/media/${key}`, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "content-length": String(buf.byteLength),
    },
    body: buf,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; bytes?: number }
  if (!res.ok) return json(res.status, { ok: false, error: data.error ?? `put-${res.status}` })
  const signed = await signLink(env, key)
  return json(200, { ok: true, url: `/api/media/${key}`, signed, bytes: data.bytes ?? buf.byteLength })
}

/** PUT admin de imagen pequeña (portadas). */
async function handlePut(req: Request, env: Env): Promise<Response> {
  if (!isAdmin(req, env)) return json(401, { ok: false, error: "not-authorized" })
  const key = new URL(req.url).searchParams.get("key") ?? ""
  if (!keyIsImage(key)) return json(400, { ok: false, error: "invalid-key" })
  const contentType = req.headers.get("content-type") ?? ""
  if (!IMAGE_TYPES.test(contentType)) return json(415, { ok: false, error: "unsupported-type" })
  const buf = await req.arrayBuffer()
  if (buf.byteLength === 0) return json(400, { ok: false, error: "empty" })
  if (buf.byteLength > MAX_PUT_BYTES) return json(413, { ok: false, error: "too-large" })
  return putSmallFile(env, key, buf, contentType)
}

/** Subida de imagen por un MIEMBRO (muro) con token corto firmado por la app. */
async function handleMemberUpload(req: Request, env: Env): Promise<Response> {
  const secret = env.MEDIA_SIGNING_KEY
  if (!secret) return json(500, { ok: false, error: "media-not-configured" })
  const url = new URL(req.url)
  const key = url.searchParams.get("key") ?? ""
  const t = url.searchParams.get("t") ?? ""
  const e = url.searchParams.get("e") ?? ""

  // Solo imágenes del muro (posts/) — no vídeos ni claves ajenas
  if (!/^posts\/[a-z0-9-]{6,64}\.(jpe?g|png|webp)$/.test(key)) {
    return json(400, { ok: false, error: "invalid-key" })
  }
  if (!t || !/^[a-f0-9]{64}$/.test(t) || !e) {
    return json(401, { ok: false, error: "invalid-token" })
  }
  const exp = Number(e)
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) >= exp) {
    return json(401, { ok: false, error: "expired-token" })
  }
  const expected = await hmacHex(secret, `up|${key}|${e}`)
  if (!safeEqualHex(expected, t)) return json(401, { ok: false, error: "invalid-token" })

  const contentType = req.headers.get("content-type") ?? ""
  if (!IMAGE_TYPES.test(contentType)) return json(415, { ok: false, error: "unsupported-type" })
  const buf = await req.arrayBuffer()
  if (buf.byteLength === 0) return json(400, { ok: false, error: "empty" })
  if (buf.byteLength > MAX_PUT_BYTES) return json(413, { ok: false, error: "too-large" })
  return putSmallFile(env, key, buf, contentType)
}

async function handleDelete(req: Request, env: Env, ctx: ExecutionContext | null): Promise<Response> {
  if (!isAdmin(req, env)) return json(401, { ok: false, error: "not-authorized" })
  const key = new URL(req.url).searchParams.get("key") ?? ""
  if (!keyKnown(key)) return json(400, { ok: false, error: "invalid-key" })
  // Borrar del DO y de la caché del borde. Se expulsa DOS veces
  // (inmediata + diferida) porque una carga completa puede estar
  // calentando la caché en segundo plano justo en ese momento.
  await relayToDO(env, key, null, "DELETE")
  const cacheReq = cacheRequestFor(key)
  const evict = () => caches.default.delete(cacheReq).catch(() => {})
  await evict()
  if (ctx) {
    ctx.waitUntil(
      new Promise<void>((resolve) => setTimeout(() => resolve(), 2000))
        .then(evict)
        .catch(() => {})
    )
  }
  return json(200, { ok: true })
}

// ---------- Entrada del worker ----------

const workerEntry: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const method = req.method.toUpperCase()

    if (url.pathname === "/health") return json(200, { ok: true, worker: "alqemia-media-v2" })

    const path = url.pathname.startsWith("/api/media/")
      ? url.pathname.slice("/api/media".length)
      : url.pathname.startsWith("/media/")
        ? url.pathname.slice("/media".length)
        : url.pathname

    // ---- Subidas y administración ----
    if (path === "/admin/upload-begin" && method === "POST") return handleUploadBegin(req, env)
    if (path === "/admin/upload-part" && method === "PUT") return handleUploadPart(req, env)
    if (path === "/admin/upload-complete" && method === "POST") return handleUploadComplete(req, env)
    if (path === "/admin/upload-abort" && method === "POST") return handleUploadAbort(req, env)
    if (path === "/admin/put" && method === "PUT") return handlePut(req, env)
    if (path === "/admin/delete" && method === "DELETE") return handleDelete(req, env, ctx)
    if (path === "/member/upload" && method === "PUT") return handleMemberUpload(req, env)

    // ---- Reproducción: /api/media/<key> ----
    const key = decodeURIComponent(path.replace(/^\//, ""))
    if (!key || key.startsWith("admin/") || key.includes("/admin")) {
      return json(404, { ok: false, error: "not-found" })
    }
    if (!keyKnown(key)) return json(404, { ok: false, error: "not-found" })
    if (method !== "GET" && method !== "HEAD") {
      return json(405, { ok: false, error: "method-not-allowed" })
    }
    if (!(await verifyLink(env, key, url))) {
      return json(401, { ok: false, error: "invalid-link" })
    }

    const rangeHeader = method === "HEAD" ? "__HEAD__" : req.headers.get("range")
    return serveMedia(env, ctx, key, req, rangeHeader)
  },
}

export default workerEntry

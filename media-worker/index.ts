// ============================================================
// ALQEMIA MEDIA — Worker de relé dedicado para los vídeos
// ------------------------------------------------------------
// PROBLEMA que resuelve: al servir vídeos grandes (p.ej. 78 MB)
// a través del worker OpenNext (Node.js), la capa de adaptación
// de streams consume CPU en exceso → Cloudflare mata la petición
// (Error 1102 "Worker exceeded CPU time limit") y la página se
// cae con el vídeo a mitad.
//
// SOLUCIÓN: este worker es workerd PURO (sin Node.js, sin
// OpenNext). Recibe las peticiones de vídeo directamente desde
// el portal (alqemiahub.pages.dev) y las transmite al Durable
// Object alqemia-db con un relé nativo de workerd → coste de
// CPU por byte prácticamente nulo. El DO ya hace streaming por
// trozos con soporte Range (206) y FixedLengthStream, así que
// la respuesta se reenvía TAL CUAL (cabeceras + Content-Length
// incluidos) sin re-tuberías costosas.
//
// Autenticación: enlace firmado (HMAC-SHA256) que la propia
// app añade a las URLs /api/media/... al devolverlas al cliente
// (?e=<caducidad>&s=<firma>). Sin sesiones ni cookies: el
// token es corto y rota en cada carga de datos.
//
// Rutas:
//   GET/HEAD /api/media/<key>?e=..&s=..  (también /media/..)
//   GET /health
// ============================================================

interface Env {
  HUB_DB: DurableObjectNamespace
  MEDIA_SIGNING_KEY?: string
}

/** Claves válidas: muro/muro-video.{mp4|webm|mov} o lessons/{id}.{ext} */
const MEDIA_KEY_RE = /^(muro\/muro-video|lessons\/[a-z0-9-]{6,64})\.(mp4|webm|mov)$/

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

/** Comparación en tiempo ~constante de dos hex strings (ya de misma longitud). */
function safeEqualHex(a: string, b: string): boolean {
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const workerEntry: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === "/health") return json(200, { ok: true, worker: "alqemia-media" })

    // Acepta /api/media/<key> (lo que envía el portal) y /media/<key>
    let path = url.pathname
    if (path.startsWith("/api/media/")) path = path.slice(4) // → /media/…
    if (!path.startsWith("/media/")) return json(404, { ok: false, error: "not-found" })

    const key = decodeURIComponent(path.slice("/media/".length))
    if (!MEDIA_KEY_RE.test(key)) return json(404, { ok: false, error: "not-found" })

    const secret = env.MEDIA_SIGNING_KEY
    if (!secret) return json(500, { ok: false, error: "media-not-configured" })

    // ---- Autenticación por enlace firmado (e = caducidad, s = firma) ----
    const eParam = url.searchParams.get("e")
    const sParam = url.searchParams.get("s")
    if (!eParam || !sParam || !/^[a-f0-9]{64}$/.test(sParam)) {
      return json(401, { ok: false, error: "invalid-link" })
    }
    const exp = Number(eParam)
    if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) >= exp) {
      return json(401, { ok: false, error: "expired-link" })
    }
    const expected = await hmacHex(secret, `${key}|${eParam}`)
    if (!safeEqualHex(expected, sParam)) {
      return json(401, { ok: false, error: "invalid-link" })
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return json(405, { ok: false, error: "method-not-allowed" })
    }

    // ---- Relé directo al Durable Object (workerd puro, CPU mínima) ----
    const stub = env.HUB_DB.get(env.HUB_DB.idFromName("primary"))
    const headers = new Headers()
    const range = req.headers.get("range")
    if (range) headers.set("range", range)
    // Se devuelve la respuesta del DO SIN re-empaquetar: el stream
    // FixedLengthStream del DO llega íntegro hasta el navegador
    // (Content-Length + Range + 206 intactos).
    return stub.fetch(`https://hub-db/media/${key}`, { method: req.method, headers })
  },
}

export default workerEntry

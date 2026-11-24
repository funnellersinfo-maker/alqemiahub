// ============================================================
// ALQEMIA — Service Worker (PWA instalable)
// Estrategias:
//   · Navegación → red primero, respaldo a "/" (offline)
//   · Estáticos (_next/static, iconos, imágenes) → caché primero
//   · APIs (/api/*) → siempre red (nunca cachear datos vivos)
//   · MEDIOS (/api/media/*) → BÓVEDA OFFLINE:
//       - Si el vídeo/imagen está descargado en la bóveda se
//         sirve LOCAL (instantáneo, sin internet, con soporte
//         Range/206 sintetizado desde el Blob cacheado).
//       - Si no → red en streaming (sin cachear).
//       - La bóveda NO se borra al actualizar el SW: las copias
//         offline de los miembros sobreviven a los despliegues.
// IMPORTANTE: al cambiar iconos o assets públicos hay que subir
// la VERSIÓN — la activación borra las cachés viejas en todos
// los dispositivos.
// ============================================================

const VERSION = "alqemia-v5"
const SHELL_CACHE = `${VERSION}-shell`
const STATIC_CACHE = `${VERSION}-static`
/** Bóveda de medios SIN versión — persiste entre despliegues. */
const VAULT_CACHE = "alqemia-media-vault"

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/images/logo-mark.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION) && k !== VAULT_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ------------------------------------------------------------
// Bóveda de medios — servir vídeos/imágenes descargados
// ------------------------------------------------------------

/** Parsea "bytes=a-b" (a o b pueden venir vacíos). */
function parseRange(range, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((range || "").trim())
  if (!m || (m[1] === "" && m[2] === "")) return null
  let start
  let end
  if (m[1] === "") {
    const suffix = Number(m[2])
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    if (!Number.isFinite(start) || start < 0) return null
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start > end || start >= size) return null
  return { start, end }
}

/**
 * Sirve un medio desde la bóveda:
 *   · Sin Range → 200 completo (el cuerpo cacheado).
 *   · Con Range → 206 PARCIAL sintetizado con blob.slice()
 *     (copia cero-costosa: el navegador la sirve a velocidad
 *     local → adelantar/retroceder instantáneo).
 * Devuelve null si el medio no está en la bóveda (→ red).
 */
async function serveFromVault(req, url) {
  const cache = await caches.open(VAULT_CACHE)
  // Clave normalizada: SOLO el path (la firma ?e=&s= rota cada
  // 30 días, la copia offline debe sobrevivir a la rotación).
  const cacheKey = new Request(url.pathname, { method: "GET" })
  const cached = await cache.match(cacheKey)
  if (!cached) return null

  if (req.method === "HEAD") {
    return new Response(null, { status: 200, headers: cached.headers })
  }

  const range = req.headers.get("range")
  if (!range) return cached

  const blob = await cached.blob()
  const size = blob.size
  const p = parseRange(range, size)
  if (!p) {
    return new Response(null, {
      status: 416,
      headers: { "content-range": `bytes */${size}`, "accept-ranges": "bytes" },
    })
  }

  const slice = blob.slice(p.start, p.end + 1)
  const headers = new Headers()
  const ct = cached.headers.get("content-type")
  if (ct) headers.set("content-type", ct)
  headers.set("accept-ranges", "bytes")
  headers.set("content-length", String(p.end - p.start + 1))
  headers.set("content-range", `bytes ${p.start}-${p.end}/${size}`)
  return new Response(slice, { status: 206, headers })
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET" && req.method !== "HEAD") return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // ---- Bóveda de medios: offline real para los vídeos ----
  if (url.pathname.startsWith("/api/media/")) {
    event.respondWith(
      serveFromVault(req, url).then((res) => {
        if (res) return res
        // No está en la bóveda → red en streaming (sin cachear:
        // los 206 parciales de la red nunca se guardan aquí).
        return fetch(req)
      })
    )
    return
  }

  // APIs: siempre red viva
  if (url.pathname.startsWith("/api/")) return

  // Navegación: red primero con respaldo offline al shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/").then((cached) => cached ?? Response.error())
      )
    )
    return
  }

  // Estáticos: caché primero
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname) ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?|css|js|webmanifest)$/.test(url.pathname)

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone))
          }
          return res
        })
      })
    )
  }
})

// ============================================================
// ALQEMIA — Service Worker (PWA instalable)
// Estrategias:
//   · Navegación → red primero, respaldo a "/" (offline)
//   · Estáticos (_next/static, iconos, imágenes) → caché primero
//   · APIs (/api/*) → siempre red (nunca cachear datos vivos)
// ============================================================

const VERSION = "alqemia-v1"
const SHELL_CACHE = `${VERSION}-shell`
const STATIC_CACHE = `${VERSION}-static`

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
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

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

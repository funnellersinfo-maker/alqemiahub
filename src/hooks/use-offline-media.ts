"use client"

// ============================================================
// BÓVEDA OFFLINE — Descarga de medios para ver sin internet
// ------------------------------------------------------------
// El reproductor de las lecciones ofrece "Descargar para ver
// sin conexión": el archivo entero viaja una vez a la Bóveda
// (Cache Storage) y a partir de ahí el Service Worker lo sirve
// LOCALMENTE — instantáneo, sin retraso, sin importar la señal.
//   · Clave normalizada = path sin firma (?e=&s= rota cada
//     30 días; la copia offline sobrevive a la rotación).
//   · Progreso real de bytes (tee del stream).
//   · Borrar descarga → libera espacio del dispositivo.
// ============================================================

import { useCallback, useEffect, useState } from "react"

export const VAULT_CACHE = "alqemia-media-vault"

export type OfflineMediaState = "unsupported" | "none" | "downloading" | "ready"

function vaultSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window && typeof caches.open === "function"
}

function pathOf(src: string | null | undefined): string | null {
  if (!src || !src.startsWith("/api/media/")) return null
  return src.split("?")[0]
}

export function useOfflineMedia(src: string | null | undefined) {
  const path = pathOf(src)
  const [state, setState] = useState<OfflineMediaState>("none")
  const [progress, setProgress] = useState(0)
  const [bytes, setBytes] = useState(0)

  const recheck = useCallback(async () => {
    if (!path || !vaultSupported()) {
      setState(path ? "none" : "unsupported")
      return
    }
    try {
      const cache = await caches.open(VAULT_CACHE)
      const hit = await cache.match(new Request(path, { method: "GET" }))
      setState(hit ? "ready" : "none")
    } catch {
      setState("none")
    }
  }, [path])

  useEffect(() => {
    void recheck()
  }, [recheck])

  /** Descarga el archivo COMPLETO (200, sin Range) a la bóveda. */
  const download = useCallback(async (): Promise<boolean> => {
    if (!path || !src || !vaultSupported()) return false
    setState("downloading")
    setProgress(0)
    try {
      // fetch completo: el media worker responde 200 con
      // Cache-Control inmutable → la CDN también lo retiene
      // junto al usuario para las próximas descargas.
      const res = await fetch(src, { cache: "no-store" })
      if (!res.ok || !res.body) throw new Error("download-failed")

      const total = Number(res.headers.get("content-length")) || 0
      const [progressBranch, cacheBranch] = res.body.tee()

      // Rama 1: progreso real de bytes
      const reader = progressBranch.getReader()
      const track = (async () => {
        let loaded = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          loaded += value?.byteLength ?? 0
          setBytes(loaded)
          if (total > 0) setProgress(Math.min(99, Math.round((loaded / total) * 100)))
        }
      })()

      // Rama 2: guardar en la bóveda con las cabeceras necesarias
      const headers = new Headers()
      for (const h of ["content-type", "content-length", "etag", "accept-ranges"]) {
        const v = res.headers.get(h)
        if (v) headers.set(h, v)
      }
      const cache = await caches.open(VAULT_CACHE)
      await cache.put(new Request(path, { method: "GET" }), new Response(cacheBranch, { headers }))
      await track
      setProgress(100)
      setState("ready")
      return true
    } catch {
      setState("none")
      return false
    }
  }, [path, src])

  /** Borra la copia local (libera espacio del dispositivo). */
  const remove = useCallback(async () => {
    if (!path || !vaultSupported()) return
    try {
      const cache = await caches.open(VAULT_CACHE)
      await cache.delete(new Request(path, { method: "GET" }))
    } catch {
      /* best-effort */
    }
    setState("none")
    setProgress(0)
    setBytes(0)
  }, [path])

  return { path, state, progress, bytes, download, remove, recheck }
}

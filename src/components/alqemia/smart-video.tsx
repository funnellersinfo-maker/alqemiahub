"use client"

// ============================================================
// SMART VIDEO — Reproductor HD "a prueba de cualquier tamaño"
// · Nunca escala el vídeo por encima de su resolución nativa:
//   un vídeo de 640 px de ancho se muestra a lo sumo a 640 px
//   (sin estirar) → nunca se ve pixelado por ampliación.
// · Los vídeos verticales quedan acotados al ~72 % de la altura
//   de la ventana, centrados con fondo negro.
// · playsInline (iOS), precarga de metadatos y poster (portada).
// · Si el vídeo falla al cargar (enlace caducado, red), muestra
//   la portada con aviso en vez de un reproductor muerto.
// ============================================================

import { useState, type SyntheticEvent } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export function SmartVideo({
  src,
  poster,
  className,
  videoClassName,
}: {
  src: string
  /** Portada (imagen) que se ve antes de dar a reproducir */
  poster?: string | null
  /** Clases del contenedor exterior (fondo negro, redondees…) */
  className?: string
  /** Clases extra para el propio <video> */
  videoClassName?: string
}) {
  // null = aún sin metadatos → ancho completo mientras carga la portada
  const [maxWidth, setMaxWidth] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  function onMetadata(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    const vw = v.videoWidth
    const vh = v.videoHeight
    if (!vw || !vh) return
    // 1) Nunca por encima de la resolución nativa (evita el pixelado).
    // 2) En verticales, acotar la altura al 72 % de la ventana.
    const maxH = typeof window === "undefined" ? 720 : window.innerHeight * 0.72
    const byHeight = (vw / vh) * maxH
    setMaxWidth(Math.max(160, Math.min(vw, byHeight)))
  }

  function onError() {
    setFailed(true)
  }

  function retry() {
    // Al pasar a failed=false el <video> se remonta desde cero →
    // el navegador hace una carga limpia (nueva petición Range).
    setFailed(false)
  }

  if (failed) {
    return (
      <div
        className={cn(
          "relative flex aspect-video w-full items-center justify-center bg-black",
          className
        )}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
          <AlertTriangle className="h-8 w-8 text-gold" aria-hidden />
          <p className="text-sm font-medium text-zinc-200">
            No se pudo cargar el vídeo
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold-bright transition-colors hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex w-full justify-center bg-black", className)}>
      <video
        controls
        playsInline
        preload="metadata"
        src={src}
        poster={poster || undefined}
        onLoadedMetadata={onMetadata}
        onError={onError}
        style={{ width: "100%", maxWidth: maxWidth ?? "100%", maxHeight: "78vh" }}
        className={cn("h-auto bg-black", videoClassName)}
      />
    </div>
  )
}

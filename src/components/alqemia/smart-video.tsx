"use client"

// ============================================================
// SMART VIDEO — Reproductor HD "a prueba de cualquier tamaño"
// · Nunca escala el vídeo por encima de su resolución nativa:
//   un vídeo de 640 px de ancho se muestra a lo sumo a 640 px
//   (sin estirar) → nunca se ve pixelado por ampliación.
// · Los vídeos verticales quedan acotados al ~72 % de la altura
//   de la ventana, centrados con fondo negro.
// · playsInline (iOS), precarga de metadatos y poster (portada).
// ============================================================

import { useState, type SyntheticEvent } from "react"
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

  return (
    <div className={cn("flex w-full justify-center bg-black", className)}>
      <video
        controls
        playsInline
        preload="metadata"
        src={src}
        poster={poster || undefined}
        onLoadedMetadata={onMetadata}
        style={{ width: "100%", maxWidth: maxWidth ?? "100%", maxHeight: "78vh" }}
        className={cn("h-auto bg-black", videoClassName)}
      />
    </div>
  )
}

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
// · offline=true → BÓVEDA SIN INTERNET: botón "Descargar" que
//   guarda el vídeo completo en el dispositivo; a partir de ahí
//   se reproduce LOCAL (instantáneo, sin señal, en avión).
// ============================================================

import { useState, type SyntheticEvent } from "react"
import { AlertTriangle, Check, CloudDownload, Loader2, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { useOfflineMedia } from "@/hooks/use-offline-media"

function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

/** Barra de la bóveda offline (bajo el reproductor). */
function OfflineVaultBar({
  vault,
}: {
  vault: ReturnType<typeof useOfflineMedia>
}) {
  if (vault.state === "unsupported") return null

  if (vault.state === "downloading") {
    return (
      <div className="mt-2 rounded-xl border border-gold/25 bg-gold/5 p-2.5" role="status" aria-label="Descargando vídeo para ver sin conexión">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex min-w-0 items-center gap-1.5 text-zinc-300">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-gold" aria-hidden />
            <span className="truncate">Descargando para ver sin internet…</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-gold-bright">
            {vault.progress > 0 ? `${vault.progress}%` : formatBytes(vault.bytes)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-bright transition-all duration-200"
            style={{ width: `${Math.max(vault.progress, 3)}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">
          {formatBytes(vault.bytes)} · puedes seguir navegando mientras baja
        </p>
      </div>
    )
  }

  if (vault.state === "ready") {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-emerald-300">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">Disponible sin conexión — se reproduce al instante</span>
        </span>
        <button
          type="button"
          onClick={() => void vault.remove()}
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          aria-label="Borrar la descarga y liberar espacio"
          title="Borrar descarga"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() =>
        void vault.download().then((ok) => {
          if (!ok) toast.error("No se pudo descargar el vídeo ahora")
        })
      }
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-[11px] font-semibold text-zinc-300 transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
    >
      <CloudDownload className="h-4 w-4 text-gold" aria-hidden />
      Descargar para ver sin internet
    </button>
  )
}

export function SmartVideo({
  src,
  poster,
  className,
  videoClassName,
  offline,
}: {
  src: string
  /** Portada (imagen) que se ve antes de dar a reproducir */
  poster?: string | null
  /** Clases del contenedor exterior (fondo negro, redondees…) */
  className?: string
  /** Clases extra para el propio <video> */
  videoClassName?: string
  /** Muestra la bóveda offline (descarga para ver sin internet) */
  offline?: boolean
}) {
  // null = aún sin metadatos → ancho completo mientras carga la portada
  const [maxWidth, setMaxWidth] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const vault = useOfflineMedia(offline ? src : null)

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
    <div className={cn("w-full", className)}>
      <div className="flex w-full justify-center bg-black">
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
      {offline ? <OfflineVaultBar vault={vault} /> : null}
    </div>
  )
}

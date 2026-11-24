"use client"

// ============================================================
// ADMIN — Subida de vídeos (archivo real, no enlaces)
// Componente compartido: Vídeo del Muro (Ajustes) y lecciones
// del Estudio.
//
// v2 — DEFINITIVA:
//   · Subida por TROCES de 8 MB con reintento por trozo → hasta
//     1,5 GB por vídeo (antes el tope era 95 MB de una sola
//     petición).
//   · Los archivos viven en R2 (CDN) → reproducción fluida.
//   · Portadas (poster) también como archivo en el almacén de
//     medios (se dejan de guardar dataURLs gigantes en la BD →
//     el hub carga mucho más rápido).
// ============================================================

import { useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { FileVideo, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SmartVideo } from "@/components/alqemia/smart-video"
import { compressImageToBlob, MAX_UPLOAD_BYTES } from "@/lib/image-utils"
import { uploadVideoChunked, uploadImageAsAdmin } from "@/lib/media-client"

/** Tope por vídeo: 1,5 GB (subida por trozos, sin límite de petición). */
const MAX_MB = 1500
const ACCEPTED_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])
const EXT_FOR_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
}

/** ¿La URL apunta a un vídeo reproducible en un <video>? */
function isDirectVideoUrl(url: string): boolean {
  return url.startsWith("/api/media/") || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)
}

/** Vista previa: <video> para archivos, iframe para YouTube heredado. */
function MediaPreview({ url, title, poster }: { url: string; title: string; poster?: string | null }) {
  if (isDirectVideoUrl(url)) {
    return (
      <SmartVideo
        src={url}
        poster={poster}
        videoClassName="max-h-[22rem]"
      />
    )
  }
  const yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i.exec(url)
  if (yt) {
    return (
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={`https://www.youtube.com/embed/${yt[1]}`}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-4 py-4 text-sm font-medium text-gold-bright transition-colors hover:text-gold"
    >
      <FileVideo className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate">{url}</span>
    </a>
  )
}

// ============================================================
// Campo de subida de vídeo
// ============================================================

export function VideoUploadField({
  scope,
  value,
  poster,
  onUploaded,
  onRemoved,
  disabled,
  compact,
}: {
  scope: "muro" | "lesson"
  /** URL actual (interna /api/media/…, o heredada externa) o "" */
  value: string
  /** Portada actual del vídeo para la vista previa */
  poster?: string | null
  /** Se llama con la URL interna LIMPIA (sin firma) cuando la subida termina */
  onUploaded: (url: string) => void
  /** Se llama al pulsar "Quitar vídeo" */
  onRemoved: () => void
  disabled?: boolean
  /** Menos alto en diálogos */
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [fileName, setFileName] = useState("")
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const type = (file.type || "").toLowerCase()
    if (!ACCEPTED_TYPES.has(type)) {
      toast.error("Formato no soportado: sube un archivo MP4, WebM o MOV")
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El vídeo supera el máximo de ${MAX_MB >= 1000 ? `${(MAX_MB / 1000).toFixed(1).replace(".0", "")} GB` : `${MAX_MB} MB`}`)
      return
    }
    const ext = EXT_FOR_TYPE[type] ?? "mp4"
    // El muro usa claves VERSIONADAS: cada sustitución es un archivo
    // nuevo → la CDN nunca sirve copias viejas.
    const key =
      scope === "muro"
        ? `muro/muro-video-v${Date.now()}.${ext}`
        : `lessons/${crypto.randomUUID()}.${ext}`
    setFileName(file.name)
    setProgress(0)
    try {
      const res = await uploadVideoChunked({
        key,
        file,
        contentType: type,
        onProgress: setProgress,
      })
      // Vista previa inmediata con el enlace firmado; a la BD se
      // guarda la URL limpia (la firma la añade la API al leer).
      setPreviewSrc(res.signed ?? res.url)
      onUploaded(res.url)
      toast.success("Vídeo subido y listo")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el vídeo")
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  const displayValue = previewSrc ?? value

  return (
    <div>
      {displayValue ? (
        <>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <MediaPreview url={displayValue} title="Vista previa del vídeo" poster={poster || null} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-700"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloud className="h-4 w-4" aria-hidden />
              Reemplazar vídeo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={disabled || busy}
              onClick={onRemoved}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Quitar vídeo
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Para HD fluido exporta en 1280×720 o 1920×1080 · hasta 1,5 GB
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 text-center transition-all hover:border-gold/50 hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-60 ${
            compact ? "px-4 py-6" : "px-4 py-10"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
            <UploadCloud className="h-5 w-5 text-gold" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-zinc-100">Subir vídeo</span>
          <span className="text-[11px] leading-relaxed text-zinc-500">
            Toca aquí y elige el archivo de tu teléfono o PC
            <br />
            MP4, WebM o MOV · hasta 1,5 GB
            <br />
            <span className="text-gold-deep">Para HD fluido: exporta en 1280×720 o 1920×1080</span>
          </span>
        </button>
      )}

      {busy && (
        <div className="mt-3 rounded-xl border border-gold/25 bg-gold/5 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-zinc-300">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gold" aria-hidden />
              <span className="truncate">{fileName || "Subiendo vídeo…"}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-gold-bright">
              {progress !== null ? `${progress}%` : "…"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-bright transition-all duration-200"
              style={{ width: `${Math.max(progress ?? 0, 4)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500">
            Subiendo por trozos con reintento automático · puedes seguir usando el panel
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="hidden"
        onChange={(e) => void onFile(e)}
        disabled={disabled || busy}
      />
    </div>
  )
}

/** Extrae la clave de almacén de una URL interna (/api/media/…). */
export function mediaKeyFromUrl(url: string): string {
  if (!url.startsWith("/api/media/")) return ""
  return url.slice("/api/media/".length).split("?")[0]
}

// ============================================================
// PORTADA DEL VÍDEO (imagen que se ve antes de dar a
// reproducir). Se recorta centrada a 16:9, se comprime a JPEG
// y se sube como ARCHIVO al almacén de medios (R2) → el JSON
// de las lecciones deja de llevar cientos de KB por portada.
// ============================================================

/** Límite ~400 KB tras comprimir. */
const MAX_POSTER_BYTES = 400 * 1024

export function PosterUploadField({
  value,
  onUploaded,
  onRemoved,
  disabled,
  /** Etiqueta del campo */
  label = "Portada del vídeo (opcional)",
  /** El muro usa clave versionada (cada sustitución es un archivo nuevo) */
  scope = "lesson",
}: {
  /** URL (o dataURL heredado) actual o "" */
  value: string
  /** Recibe la URL interna limpia de la portada subida */
  onUploaded: (url: string) => void
  onRemoved: () => void
  disabled?: boolean
  label?: string
  scope?: "lesson" | "muro"
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Sube una imagen (JPG o PNG)")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("La imagen supera los 8 MB")
      return
    }
    setProcessing(true)
    try {
      // Recorte centrado 16:9 + JPEG a ancho máx. 1280 (portada HD)
      const blob = await compressImageToBlob(file, { maxWidth: 1280, aspect: 16 / 9, quality: 0.82 })
      if (blob.size > MAX_POSTER_BYTES) {
        toast.error("La portada supera los 400 KB tras comprimirla. Prueba con una más ligera.")
        return
      }
      const key =
        scope === "muro"
          ? `muro/muro-poster-v${Date.now()}.jpg`
          : `posters/${crypto.randomUUID()}.jpg`
      const res = await uploadImageAsAdmin({ key, blob })
      setPreviewSrc(res.signed ?? res.url)
      onUploaded(res.url)
      toast.success("Portada lista")
    } catch {
      toast.error("No se pudo procesar la imagen")
    } finally {
      setProcessing(false)
    }
  }

  const displayValue = previewSrc ?? value

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
            disabled={disabled || processing}
            onClick={onRemoved}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Quitar
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e)}
        disabled={disabled || processing}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || processing}
        className="mt-2 block w-full overflow-hidden rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 transition-all hover:border-gold/50 hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-60"
        aria-label={label}
      >
        {displayValue ? (
          <span className="relative block aspect-video w-full">
            <img
              src={displayValue}
              alt="Vista previa de la portada del vídeo"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {processing ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden />
              </span>
            ) : null}
          </span>
        ) : (
          <span className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 text-zinc-600">
            {processing ? (
              <Loader2 className="h-6 w-6 animate-spin text-gold" aria-hidden />
            ) : (
              <ImagePlus className="h-6 w-6" aria-hidden />
            )}
            <span className="text-xs font-medium text-zinc-400">
              {processing ? "Procesando imagen…" : "Subir portada"}
            </span>
          </span>
        )}
      </button>

      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
        Medidas recomendadas: <span className="text-zinc-400">1280 × 720 px (16:9)</span> · JPG o
        PNG · se recorta y comprime automáticamente.
      </p>
    </div>
  )
}

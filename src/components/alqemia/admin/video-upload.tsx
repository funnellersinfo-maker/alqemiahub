"use client"

// ============================================================
// ADMIN — Subida de vídeos (archivo real, no enlaces)
// Componente compartido: Vídeo del Muro (Ajustes) y lecciones
// del Estudio. Sube el archivo en streaming con barra de
// progreso (XHR) y muestra vista previa del vídeo actual.
// ============================================================

import { useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { FileVideo, Loader2, Trash2, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"

const MAX_MB = 95
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
function MediaPreview({ url, title }: { url: string; title: string }) {
  if (isDirectVideoUrl(url)) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        playsInline
        className="w-full bg-black"
        style={{ aspectRatio: "16 / 9", maxHeight: "22rem" }}
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

/** Sube el archivo con XHR (progreso real) y la clave de admin. */
function uploadMediaFile(
  key: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; url?: string; bytes?: number; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/api/admin/media?key=${encodeURIComponent(key)}`)
    xhr.setRequestHeader("x-admin-key", localStorage.getItem("alqemia-admin-key") ?? "")
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let data: { ok?: boolean; url?: string; error?: string } = {}
      try {
        data = JSON.parse(xhr.responseText) as typeof data
      } catch {
        /* respuesta sin JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        resolve({ ok: true, url: data.url, bytes: (data as { bytes?: number }).bytes })
      } else {
        reject(new Error(data.error ?? `Error ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error("Error de red al subir el vídeo"))
    xhr.send(file)
  })
}

// ============================================================
// Campo de subida
// ============================================================

export function VideoUploadField({
  scope,
  value,
  onUploaded,
  onRemoved,
  disabled,
  compact,
}: {
  scope: "muro" | "lesson"
  /** URL actual (interna /api/media/…, o heredada externa) o "" */
  value: string
  /** Se llama con la URL interna cuando la subida termina */
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
      toast.error(`El vídeo supera el máximo de ${MAX_MB} MB`)
      return
    }
    const ext = EXT_FOR_TYPE[type] ?? "mp4"
    const key = scope === "muro" ? `muro/muro-video.${ext}` : `lessons/${crypto.randomUUID()}.${ext}`
    setFileName(file.name)
    setProgress(0)
    try {
      const res = await uploadMediaFile(key, file, setProgress)
      if (res.url) {
        onUploaded(res.url)
        toast.success("Vídeo subido y listo")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el vídeo")
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

  return (
    <div>
      {value ? (
        <>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <MediaPreview url={value} title="Vista previa del vídeo" />
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
            MP4, WebM o MOV · hasta {MAX_MB} MB
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
            Subiendo en streaming · no cierres esta pestaña
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
  return url.startsWith("/api/media/") ? url.slice("/api/media/".length) : ""
}

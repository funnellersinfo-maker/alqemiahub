"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ImageIcon, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/alqemia/avatar"
import { useMe } from "@/hooks/use-me"
import { celebrateXp } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { FeedPost, XpEvent } from "@/lib/types"

const MAX_LENGTH = 2000
const SOFT_LIMIT = 1800
const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB
const MAX_DATA_URL_LENGTH = 380_000
const MAX_SIDE_PX = 720

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("file-read-error"))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img")
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image-decode-error"))
    img.src = src
  })
}

/**
 * Redimensiona la imagen con canvas (máx. 720px por lado, proporcional)
 * y la codifica como JPEG dataURL acotado para viajar en el POST.
 * Devuelve null si la imagen sigue siendo demasiado grande.
 */
async function compressToDataUrl(file: File): Promise<string | null> {
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  let out = canvas.toDataURL("image/jpeg", 0.8)
  if (out.length > MAX_DATA_URL_LENGTH) {
    out = canvas.toDataURL("image/jpeg", 0.6)
  }
  if (out.length > MAX_DATA_URL_LENGTH) return null
  return out
}

export function PostComposer() {
  const queryClient = useQueryClient()
  const me = useMe()
  const [content, setContent] = useState("")
  const [imageDataURL, setImageDataURL] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const meUser = me.data?.user
  const firstName = meUser?.name.trim().split(/\s+/)[0] ?? ""

  async function handleSelectImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // permite volver a seleccionar el mismo archivo
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen")
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("La imagen es demasiado grande")
      return
    }
    try {
      const compressed = await compressToDataUrl(file)
      if (!compressed) {
        toast.error("La imagen es demasiado grande")
        return
      }
      setImageDataURL(compressed)
    } catch {
      toast.error("No se pudo procesar la imagen")
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = content.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      const payload: { content: string; image?: string } = { content: text }
      if (imageDataURL) payload.image = imageDataURL

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { post?: FeedPost; xp?: XpEvent; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo publicar. Inténtalo de nuevo")
        return
      }
      setContent("")
      setImageDataURL(null)
      void queryClient.invalidateQueries({ queryKey: ["feed"] })
      celebrateXp(json.xp)
      void queryClient.invalidateQueries({ queryKey: ["me"] })
    } catch {
      toast.error("Error de red. Inténtalo de nuevo")
    } finally {
      setPosting(false)
    }
  }

  return (
    <Card className="gap-0 rounded-2xl border-zinc-800 bg-zinc-950 p-4">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start gap-3">
          {meUser ? (
            <UserAvatar user={meUser} size="md" />
          ) : (
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          )}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_LENGTH}
            placeholder={`¿Qué estás construyendo hoy${firstName ? `, ${firstName}` : ""}?`}
            aria-label="Escribe tu publicación"
            className="min-h-[64px] resize-none border-0 p-0 text-[15px] shadow-none focus-visible:ring-0"
          />
        </div>

        {imageDataURL && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-zinc-800">
            { }
            <img src={imageDataURL} alt="Adjunto" className="max-h-72 w-full object-cover" />
            <button
              type="button"
              aria-label="Quitar imagen"
              onClick={() => setImageDataURL(null)}
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950/60 text-white transition-colors hover:bg-zinc-950/80"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSelectImage}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-zinc-100"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon aria-hidden />
            Foto
          </Button>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-xs",
                content.length > SOFT_LIMIT ? "text-gold-deep" : "text-zinc-400"
              )}
            >
              {content.length}/{MAX_LENGTH}
            </span>
            <Button type="submit" size="sm" disabled={!content.trim() || posting}>
              {posting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Publicar
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}

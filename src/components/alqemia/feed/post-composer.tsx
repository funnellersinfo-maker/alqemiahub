"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, FileBarChart, ImageIcon, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"
import { UserAvatar } from "@/components/alqemia/avatar"
import { useMe } from "@/hooks/use-me"
import { celebrateXp } from "@/lib/store"
import { compressImageToBlob } from "@/lib/image-utils"
import { uploadMemberImage } from "@/lib/media-client"
import { cn } from "@/lib/utils"
import type { FeedPost, XpEvent } from "@/lib/types"

const MAX_LENGTH = 2000
const SOFT_LIMIT = 1800
const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB de archivo original
const MAX_SIDE_PX = 720
const MAX_IMAGE_BYTES = 380 * 1024 // 380 KB tras comprimir

// Rangos de las métricas de evidencia (espejo de la validación del servidor)
const MAX_REVENUE = 10_000_000 // USD
const MAX_ORDERS = 100_000
const MAX_ROAS = 100

type PostPayload = {
  content: string
  image?: string
  metricRevenue?: number
  metricOrders?: number
  metricRoas?: number
}

export function PostComposer() {
  const queryClient = useQueryClient()
  const me = useMe()
  const [content, setContent] = useState("")
  const [imageURL, setImageURL] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Formulario de resultados del período (evidencia pública)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [revenueInput, setRevenueInput] = useState("")
  const [ordersInput, setOrdersInput] = useState("")
  const [roasInput, setRoasInput] = useState("")

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
    setUploading(true)
    try {
      // Comprimir y subir como ARCHIVO al almacén de medios (R2):
      // el post viaja en JSON ligero (una URL) y el muro carga al
      // instante — sin megabytes de base64 en el feed.
      const blob = await compressImageToBlob(file, { maxWidth: MAX_SIDE_PX, quality: 0.8 })
      if (blob.size > MAX_IMAGE_BYTES) {
        toast.error("La imagen es demasiado grande")
        return
      }
      const key = `posts/${crypto.randomUUID()}.jpg`
      const res = await uploadMemberImage({ key, blob })
      setImageURL(res.signed ?? res.url)
    } catch {
      toast.error("No se pudo subir la imagen")
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = content.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      // ---- Métricas de evidencia (solo si el usuario reportó algo) ----
      const revenueRaw = revenueInput.trim()
      const ordersRaw = ordersInput.trim()
      const roasRaw = roasInput.trim()

      const revenue = revenueRaw ? Number(revenueRaw) : null
      const orders = ordersRaw ? Number(ordersRaw) : null
      const roas = roasRaw ? Number(roasRaw) : null

      if (
        revenue !== null &&
        (!Number.isFinite(revenue) || revenue < 0 || revenue > MAX_REVENUE)
      ) {
        toast.error(`La facturación debe estar entre 0 y ${MAX_REVENUE.toLocaleString("es")} USD`)
        return
      }
      if (
        orders !== null &&
        (!Number.isFinite(orders) || !Number.isInteger(orders) || orders < 0 || orders > MAX_ORDERS)
      ) {
        toast.error("Los pedidos deben ser un número entero entre 0 y 100.000")
        return
      }
      if (roas !== null && (!Number.isFinite(roas) || roas < 0 || roas > MAX_ROAS)) {
        toast.error("El ROAS debe estar entre 0 y 100")
        return
      }

      const payload: PostPayload = { content: text }
      if (imageURL) payload.image = imageURL.split("?")[0]!
      if (revenue !== null && revenue > 0) {
        payload.metricRevenue = Math.round(revenue * 100) / 100
      }
      if (orders !== null && orders > 0) payload.metricOrders = orders
      if (roas !== null && roas > 0) payload.metricRoas = Math.round(roas * 10) / 10

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
      setImageURL(null)
      setRevenueInput("")
      setOrdersInput("")
      setRoasInput("")
      setMetricsOpen(false)
      void queryClient.invalidateQueries({ queryKey: ["feed"] })
      celebrateXp(json.xp)
      void queryClient.invalidateQueries({ queryKey: ["me"] })
    } catch {
      toast.error("Error de red. Inténtalo de nuevo")
    } finally {
      setPosting(false)
    }
  }

  const metricInputCls =
    "h-9 border-zinc-800 bg-zinc-950 text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

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

        {imageURL && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-zinc-800">
            <img src={imageURL} alt="Adjunto" className="max-h-72 w-full object-cover" />
            <button
              type="button"
              aria-label="Quitar imagen"
              onClick={() => setImageURL(null)}
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950/60 text-white transition-colors hover:bg-zinc-950/80"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {uploading && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/5 px-3 py-2 text-xs text-zinc-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden />
            Subiendo imagen…
          </div>
        )}

        <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen} className="mt-3">
          <CollapsibleTrigger
            className={cn(
              "group flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-zinc-900/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40"
            )}
          >
            <FileBarChart
              className="h-4 w-4 shrink-0 text-gold/80 transition-colors group-hover:text-gold-bright"
              aria-hidden
            />
            <AlqemiaLetters
              text="Reportar resultados del período"
              strokeWidth={11}
              className="text-[11px] sm:text-xs"
            />
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-hover:text-zinc-300",
                metricsOpen && "rotate-180"
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-zinc-400">
                  Facturación (USD)
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={revenueInput}
                  onChange={(e) => setRevenueInput(e.target.value)}
                  disabled={posting}
                  aria-label="Facturación del período en dólares"
                  className={metricInputCls}
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-zinc-400">Pedidos</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={ordersInput}
                  onChange={(e) => setOrdersInput(e.target.value)}
                  disabled={posting}
                  aria-label="Pedidos del período"
                  className={metricInputCls}
                />
              </label>
              <label className="block min-w-0 col-span-2 sm:col-span-1">
                <span className="mb-1 block text-[11px] font-medium text-zinc-400">ROAS</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  placeholder="Ej. 3.2"
                  title="Retorno sobre inversión publicitaria"
                  value={roasInput}
                  onChange={(e) => setRoasInput(e.target.value)}
                  disabled={posting}
                  aria-label="ROAS del período"
                  className={metricInputCls}
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              <span className="font-semibold text-gold-bright">El Evaluador</span> valora tu
              evidencia (hasta +120 XP según facturación, pedidos y ROAS) y queda como evidencia
              pública en el muro. Solo reporta cifras reales.
            </p>
          </CollapsibleContent>
        </Collapsible>

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
            disabled={uploading || posting}
          >
            {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImageIcon aria-hidden />}
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

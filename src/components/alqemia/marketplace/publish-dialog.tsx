"use client"

// ============================================================
// MARKETPLACE — Diálogo para publicar un producto
// (Micro App, Producto Digital, Producto Físico o Servicio)
// ============================================================

import { useRef, useState, type ChangeEvent } from "react"
import { ImagePlus, Loader2, PackagePlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { compressImage } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/types"

const CURRENCIES = ["USD", "EUR", "COP", "MXN", "ARS", "PEN", "CLP"]

export function PublishDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<ProductCategory>("MICRO_APP")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [commissionPct, setCommissionPct] = useState("50")
  const [recurring, setRecurring] = useState(false)
  const [contentUrl, setContentUrl] = useState("")
  const [cover, setCover] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("La portada debe ser una imagen")
      return
    }
    setProcessing(true)
    try {
      setCover(await compressImage(file, { maxWidth: 1280, aspect: 16 / 9, quality: 0.8 }))
    } catch {
      toast.error("No se pudo procesar la imagen")
    } finally {
      setProcessing(false)
    }
  }

  async function submit() {
    if (title.trim().length < 3) {
      toast.error("Escribe un título de al menos 3 caracteres")
      return
    }
    const p = Number(price)
    if (!Number.isFinite(p) || p < 0) {
      toast.error("Precio inválido")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim(),
          price: p,
          currency,
          commissionPct: Number(commissionPct) || 0,
          recurring,
          contentUrl: contentUrl.trim() || undefined,
          coverImage: cover ?? undefined,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(j.error ?? "No se pudo publicar el producto")
        return
      }
      toast.success("Producto publicado en el Marketplace")
      setTitle("")
      setDescription("")
      setPrice("")
      setRecurring(false)
      setContentUrl("")
      setCover(null)
      setCategory("MICRO_APP")
      onOpenChange(false)
      onDone()
    } catch {
      toast.error("No se pudo publicar el producto")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg text-zinc-100">
            <PackagePlus className="h-5 w-5 text-gold-bright" aria-hidden />
            Publicar en el Marketplace
          </DialogTitle>
          <DialogDescription>
            Crea tu oferta: otros miembros podrán revenderla y ganar comisión como aliados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pub-title">Título</Label>
            <Input
              id="pub-title"
              placeholder="Ej. Micro App de reservas para barberías"
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
                <SelectTrigger className="mt-2 border-zinc-800 bg-zinc-950/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-950">
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pub-currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-2 border-zinc-800 bg-zinc-950/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-950">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="pub-desc">Descripción</Label>
            <Textarea
              id="pub-desc"
              rows={4}
              maxLength={4000}
              placeholder="Qué incluye, para quién es, cómo se entrega…"
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pub-price">Precio</Label>
              <Input
                id="pub-price"
                inputMode="decimal"
                placeholder="19"
                className="mt-2 border-zinc-800 bg-zinc-950/70"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pub-commission">Comisión de aliados (%)</Label>
              <Input
                id="pub-commission"
                inputMode="numeric"
                className="mt-2 border-zinc-800 bg-zinc-950/70"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
            <div>
              <p className="text-sm font-medium text-zinc-200">Pago recurrente (mensual)</p>
              <p className="text-xs text-zinc-500">Ej. membresías de micro apps</p>
            </div>
            <Switch checked={recurring} onCheckedChange={setRecurring} aria-label="Pago recurrente" />
          </div>

          <div>
            <Label htmlFor="pub-content">Enlace del material (Drive, Notion, video…)</Label>
            <Input
              id="pub-content"
              placeholder="https://drive.google.com/…"
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Solo lo verán tú y tus aliados confirmados
            </p>
          </div>

          <div>
            <Label>Portada 16:9 (opcional)</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "mt-2 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 transition-colors hover:border-gold/50 hover:text-zinc-200",
                cover ? "aspect-video" : "p-4"
              )}
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : cover ? (
                <img src={cover} alt="Vista previa de la portada" className="h-full w-full object-cover" />
              ) : (
                <span className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5" aria-hidden />
                  Adjuntar imagen de portada
                </span>
              )}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-800">
            Cancelar
          </Button>
          <Button className="btn-gold font-semibold" disabled={submitting} onClick={() => void submit()}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

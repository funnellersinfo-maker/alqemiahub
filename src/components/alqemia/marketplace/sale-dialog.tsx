"use client"

// ============================================================
// MARKETPLACE — Diálogo para registrar una venta como aliado
// (o venta directa del creador) con comprobante de pago
// ============================================================

import { useRef, useState, type ChangeEvent } from "react"
import { ImagePlus, Loader2, Receipt, Send } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { compressImage } from "@/lib/image-utils"
import type { ProductDTO } from "@/lib/types"

export function SaleDialog({
  product,
  open,
  onOpenChange,
  onDone,
}: {
  product: ProductDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [buyerName, setBuyerName] = useState("")
  const [buyerContact, setBuyerContact] = useState("")
  const [amount, setAmount] = useState(String(product.price))
  const [note, setNote] = useState("")
  const [proof, setProof] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isDirect = product.isMine
  const commission = isDirect
    ? 0
    : Math.round(((Number(amount) || 0) * product.commissionPct) / 100 * 100) / 100

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("El comprobante debe ser una imagen")
      return
    }
    setProcessing(true)
    try {
      setProof(await compressImage(file, { maxWidth: 1000, quality: 0.72 }))
    } catch {
      toast.error("No se pudo procesar la imagen del comprobante")
    } finally {
      setProcessing(false)
    }
  }

  async function submit() {
    if (buyerName.trim().length < 2) {
      toast.error("Escribe el nombre del comprador")
      return
    }
    const n = Number(amount)
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Monto inválido")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/marketplace/${product.id}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName: buyerName.trim(),
          buyerContact: buyerContact.trim() || undefined,
          amount: n,
          note: note.trim() || undefined,
          proofImage: proof ?? undefined,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(j.error ?? "No se pudo registrar la venta")
        return
      }
      toast.success(
        isDirect
          ? "Venta directa registrada"
          : "Venta registrada: queda pendiente de confirmación por el creador"
      )
      setBuyerName("")
      setBuyerContact("")
      setNote("")
      setProof(null)
      onOpenChange(false)
      onDone()
    } catch {
      toast.error("No se pudo registrar la venta")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg text-zinc-100">
            <Receipt className="h-5 w-5 text-gold-bright" aria-hidden />
            Registrar venta
          </DialogTitle>
          <DialogDescription>
            {isDirect ? "Venta directa" : `Como aliado · ${product.title}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="sale-buyer">Nombre del comprador</Label>
            <Input
              id="sale-buyer"
              placeholder="Ej. María Gómez"
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sale-contact">Contacto del comprador</Label>
              <Input
                id="sale-contact"
                placeholder="WhatsApp o email"
                className="mt-2 border-zinc-800 bg-zinc-950/70"
                value={buyerContact}
                onChange={(e) => setBuyerContact(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sale-amount">Monto ({product.currency})</Label>
              <Input
                id="sale-amount"
                inputMode="decimal"
                className="mt-2 border-zinc-800 bg-zinc-950/70"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Comprobante de pago</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400 transition-colors hover:border-gold/50 hover:text-zinc-200"
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : proof ? (
                <img src={proof} alt="Vista previa del comprobante" className="max-h-28 rounded-lg object-contain" />
              ) : (
                <ImagePlus className="h-5 w-5" aria-hidden />
              )}
              {processing
                ? "Procesando imagen…"
                : proof
                  ? "Cambiar comprobante (toca aquí)"
                  : "Adjuntar imagen del comprobante de pago"}
            </button>
          </div>

          <div>
            <Label htmlFor="sale-note">Nota (opcional)</Label>
            <Textarea
              id="sale-note"
              rows={2}
              maxLength={300}
              placeholder="Ej. Pagó por transferencia, envía acceso el lunes…"
              className="mt-2 resize-none border-zinc-800 bg-zinc-950/70"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-gold/25 bg-gold/5 p-3 text-sm">
            {isDirect ? (
              <p className="text-zinc-300">
                Venta directa: <strong className="text-gold-bright">tú eres el creador</strong>, queda confirmada de
                inmediato y no genera comisión.
              </p>
            ) : (
              <p className="text-zinc-300">
                Tu comisión como aliado ({product.commissionPct}%):{" "}
                <strong className="text-gold-bright">
                  {commission} {product.currency}
                </strong>{" "}
                · La venta queda <strong>pendiente</strong> hasta que el creador la confirme.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-800">
            Cancelar
          </Button>
          <Button className="btn-gold font-semibold" disabled={submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            Registrar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

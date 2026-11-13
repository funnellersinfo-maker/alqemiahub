"use client"

// ============================================================
// HERRAMIENTA — Whalink: generador de enlaces de WhatsApp
// Número + mensaje → wa.me corto + QR HD con el logo de
// ALQEMIA al centro. Copiar, regenerar y descargar.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy, Download, Loader2, MessageCircle, QrCode, RefreshCw, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ---------------- Lógica de WhatsApp ----------------

/** Normaliza a dígitos con código de país (sin +, espacios ni guiones). */
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "")
}

/** Valida: 8–15 dígitos incluyendo código de país. */
function isValidPhone(normalized: string): boolean {
  return normalized.length >= 8 && normalized.length <= 15
}

/** Construye https://wa.me/<numero>?text=<mensaje> */
export function buildWhalink(rawPhone: string, message: string): string | null {
  const phone = normalizePhone(rawPhone)
  if (!isValidPhone(phone)) return null
  const text = message.trim()
  return text
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}`
}

// ---------------- Generación del QR con logo ----------------

type QRGen = typeof import("qrcode")

let qrModulePromise: Promise<QRGen> | null = null
function getQrModule(): Promise<QRGen> {
  if (!qrModulePromise) qrModulePromise = import("qrcode")
  return qrModulePromise
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("No se pudo cargar el logo"))
    img.src = src
  })
}

/**
 * Genera el QR en HD (1024px) con corrección de errores H y dibuja
 * el logo de ALQEMIA al centro sobre un disco dorado.
 */
async function generateQrWithLogo(link: string): Promise<string> {
  const QR = await getQrModule()
  const qrDataUrl = await QR.toDataURL(link, {
    errorCorrectionLevel: "H", // 30% del QR puede estar tapado por el logo
    width: 1024,
    margin: 2,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  })

  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas no disponible")

  const qrImg = await loadImage(qrDataUrl)
  ctx.drawImage(qrImg, 0, 0, 1024, 1024)

  // Disco dorado al centro con el logo
  const cx = 512
  const cy = 512
  const radius = 150
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.25)
  glow.addColorStop(0, "rgba(212,175,55,0.95)")
  glow.addColorStop(1, "rgba(212,175,55,0)")
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = "#0d0a04"
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 10
  ctx.strokeStyle = "#d4af37"
  ctx.beginPath()
  ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2)
  ctx.stroke()

  const logo = await loadImage("/images/logo-mark.png")
  const logoSize = radius * 1.35
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius - 12, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(logo, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize)
  ctx.restore()

  return canvas.toDataURL("image/png")
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ---------------- Componente ----------------

export function WhalinkTool() {
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [withQr, setWithQr] = useState(true)
  const [link, setLink] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const qrKey = useRef(0)

  const generate = useCallback(async () => {
    const built = buildWhalink(phone, message)
    if (!built) {
      toast.error("Revisa el número: debe incluir el código de país (ej. 573001234567)")
      return
    }
    setBusy(true)
    try {
      setLink(built)
      setCopied(false)
      if (withQr) {
        qrKey.current += 1
        const dataUrl = await generateQrWithLogo(built)
        setQr(dataUrl)
        toast.success("Whalink generado: el QR es único para ese número y mensaje")
      } else {
        setQr(null)
      }
    } catch {
      toast.error("No se pudo generar el QR. Intenta de nuevo.")
    } finally {
      setBusy(false)
    }
  }, [phone, message, withQr])

  // Regenera automáticamente al cambiar el interruptor de QR
  useEffect(() => {
    if (link && !withQr) setQr(null)
  }, [withQr, link])

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success("Enlace copiado")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace manualmente.")
    }
  }

  return (
    <Card className="gate-card gap-0 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <MessageCircle className="h-5 w-5 text-gold-bright" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-100">Whalink</h3>
          <p className="mt-0.5 text-sm text-zinc-500">
            Genera un enlace de WhatsApp con tu mensaje precargado y su QR listo para compartir.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="whalink-phone">Número de WhatsApp (con código de país)</Label>
          <Input
            id="whalink-phone"
            inputMode="tel"
            placeholder="573001234567"
            className="mt-2 h-11 border-zinc-800 bg-zinc-950/70 focus-visible:border-gold/50 focus-visible:ring-gold/25"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-zinc-500">Ej.: Colombia 57 · México 52 · España 34 · Argentina 54</p>
        </div>

        <div>
          <Label htmlFor="whalink-msg">Mensaje precargado (opcional)</Label>
          <Textarea
            id="whalink-msg"
            rows={3}
            maxLength={500}
            placeholder="¡Hola! Vengo del Hub de ALQEMIA y quiero más información…"
            className="mt-2 resize-none border-zinc-800 bg-zinc-950/70 focus-visible:border-gold/50 focus-visible:ring-gold/25"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
          <div className="flex items-center gap-3">
            <QrCode className="h-5 w-5 text-gold-bright" aria-hidden />
            <div>
              <p className="text-sm font-medium text-zinc-200">Generar QR con el logo</p>
              <p className="text-xs text-zinc-500">QR en HD, único para ese número y mensaje</p>
            </div>
          </div>
          <Switch checked={withQr} onCheckedChange={setWithQr} aria-label="Generar QR" />
        </div>

        <Button type="button" className="btn-gold h-11 w-full font-semibold" disabled={busy} onClick={() => void generate()}>
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Send aria-hidden />
          )}
          Generar mi Whalink
        </Button>
      </div>

      {link && (
        <div className="animate-view mt-5 space-y-4 rounded-xl border border-gold/25 bg-gold/5 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-bright">Tu enlace</p>
            <p className="mt-1 break-all rounded-lg bg-zinc-950/80 p-3 font-mono text-xs text-zinc-300">{link}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => void copyLink()}>
              {copied ? <Check className="h-4 w-4 text-green-400" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copiado" : "Copiar enlace"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={busy}
              onClick={() => void generate()}
            >
              <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} aria-hidden />
              Regenerar QR
            </Button>
            {qr && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => downloadDataUrl(qr, `alqemia-whalink-${normalizePhone(phone)}.png`)}
              >
                <Download className="h-4 w-4" aria-hidden />
                Descargar QR
              </Button>
            )}
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button type="button" size="sm" variant="outline" className="gap-2">
                <MessageCircle className="h-4 w-4 text-green-400" aria-hidden />
                Probar
              </Button>
            </a>
          </div>

          {qr && (
            <div className="flex flex-col items-center pt-2">
              <img
                key={qrKey.current}
                src={qr}
                alt="Código QR de WhatsApp con el logo de ALQEMIA"
                className="animate-portal-in w-52 rounded-2xl shadow-[0_0_40px_-10px_rgba(212,175,55,0.5)]"
              />
              <p className="mt-2 text-center text-xs text-zinc-500">
                Escanea con la cámara del teléfono: abre tu chat con el mensaje listo
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

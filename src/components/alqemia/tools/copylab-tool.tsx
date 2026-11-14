"use client"

// ============================================================
// COPYLAB DE ÉLITE — 3 variantes con frameworks AIDA · PAS ·
// PASTOR + niveles de conciencia (Schwartz) + gatillos mentales
// + sesgos cognitivos + neuromarketing. Cada variante muestra
// QUÉ psicología usa y por qué convierte.
// ============================================================

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Brain, Copy, Eye, Loader2, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { CopyLabAwareness, CopyLabType, CopyLabVariant } from "@/lib/types"

type CopyLabPayload = {
  type: CopyLabType
  product: string
  audience: string
  tone: string
  awareness: CopyLabAwareness
}

type CopyLabResponse = { results: CopyLabVariant[] }

const AWARENESS_OPTIONS: { value: CopyLabAwareness; label: string; hint: string }[] = [
  { value: "auto", label: "Detectar automáticamente", hint: "El Oráculo decide según tu audiencia" },
  { value: "unconscious", label: "1 · Ni sabe que tiene el problema", hint: "Primero se nombra el dolor" },
  { value: "problem", label: "2 · Conoce el problema, no las soluciones", hint: "Se agita y se presenta el puente" },
  { value: "solution", label: "3 · Sabe que hay soluciones, no te conoce", hint: "Te diferencias de la competencia" },
  { value: "product", label: "4 · Te conoce, aún no compra", hint: "Se derriban objeciones con prueba" },
  { value: "most", label: "5 · Está comparando opciones", hint: "Gana la oferta y la prueba social" },
]

async function generateCopy(payload: CopyLabPayload): Promise<CopyLabResponse> {
  const res = await fetch("/api/tools/copylab", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  let json: CopyLabResponse | { error: string } | null = null
  try {
    json = (await res.json()) as CopyLabResponse | { error: string }
  } catch {
    json = null
  }
  if (!res.ok || !json || !("results" in json)) {
    const message =
      json && "error" in json && typeof json.error === "string"
        ? json.error
        : "El CopyLab no está disponible. Intenta de nuevo."
    throw new Error(message)
  }
  return json
}

export function CopyLabTool() {
  const [type, setType] = useState<CopyLabType>("product")
  const [product, setProduct] = useState("")
  const [audience, setAudience] = useState("")
  const [tone, setTone] = useState("Profesional")
  const [awareness, setAwareness] = useState<CopyLabAwareness>("auto")
  const [results, setResults] = useState<CopyLabVariant[] | null>(null)

  const mutation = useMutation({
    mutationFn: generateCopy,
    onSuccess: (data) => setResults(data.results ?? []),
    onError: (err) =>
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "El CopyLab no está disponible. Intenta de nuevo."
      ),
  })

  const copyVariant = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copiado")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  const awarenessHint = AWARENESS_OPTIONS.find((o) => o.value === awareness)?.hint

  return (
    <Card className="flex h-full flex-col gap-0 rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <Sparkles className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold leading-none text-zinc-100">CopyLab de Élite</h2>
          <p className="mt-1 text-xs text-zinc-500">
            3 variantes AIDA · PAS · PASTOR con gatillos mentales y neuromarketing
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Tipo de copy</Label>
            <Select value={type} onValueChange={(v) => setType(v as CopyLabType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Descripción de producto</SelectItem>
                <SelectItem value="social">Post para redes</SelectItem>
                <SelectItem value="ad">Guion de anuncio</SelectItem>
                <SelectItem value="email">Email de venta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Tono</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un tono" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Profesional">Profesional</SelectItem>
                <SelectItem value="Cercano">Cercano</SelectItem>
                <SelectItem value="Urgente">Urgente</SelectItem>
                <SelectItem value="De lujo">De lujo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cl-product" className="text-xs text-zinc-500">
            ¿Qué vendes?
          </Label>
          <Textarea
            id="cl-product"
            rows={2}
            placeholder="Ej: Serums faciales orgánicos para piel sensible"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-audience" className="text-xs text-zinc-500">
            ¿A quién le vendes?
          </Label>
          <Input
            id="cl-audience"
            placeholder="Ej: Mujeres 25-40 que cuidan su piel"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Nivel de conciencia de tu audiencia
          </Label>
          <Select value={awareness} onValueChange={(v) => setAwareness(v as CopyLabAwareness)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona el nivel" />
            </SelectTrigger>
            <SelectContent>
              {AWARENESS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {awarenessHint && (
            <p className="text-[11px] leading-snug text-zinc-600">{awarenessHint}</p>
          )}
        </div>

        <Button
          className="btn-gold w-full font-semibold"
          disabled={!product.trim() || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              type,
              product: product.trim(),
              audience: audience.trim(),
              tone,
              awareness,
            })
          }
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {mutation.isPending ? "Forjando variantes…" : "Generar 3 variantes de élite"}
        </Button>
      </div>

      {mutation.isPending ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : results === null ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-400">
          Completa el formulario y genera tus copys de élite
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {results.map((variant, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 transition-colors hover:border-gold/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="border-gold/40 bg-gold/10 font-semibold tracking-wide text-gold-bright">
                  {variant.framework}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0"
                  aria-label="Copiar variante"
                  onClick={() => copyVariant(variant.copy)}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {variant.copy}
              </p>
              {variant.triggers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {variant.triggers.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-inset ring-zinc-800"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {variant.why && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-gold/5 px-2.5 py-2 text-[11px] leading-snug text-gold/80 ring-1 ring-inset ring-gold/15">
                  <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold text-gold-bright">Por qué convierte: </span>
                    {variant.why}
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

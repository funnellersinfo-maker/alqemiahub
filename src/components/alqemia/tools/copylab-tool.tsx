"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Copy, Loader2, Sparkles } from "lucide-react"

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
import type { CopyLabType } from "@/lib/types"

type CopyLabPayload = {
  type: CopyLabType
  product: string
  audience: string
  tone: string
}

type CopyLabResponse = { results: string[] }

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
  const [results, setResults] = useState<string[] | null>(null)

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

  return (
    <Card className="flex h-full flex-col gap-0 rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <Sparkles className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold leading-none text-zinc-100">CopyLab IA</h2>
          <p className="mt-1 text-xs text-zinc-500">
            3 variantes de copy persuasivo en segundos
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
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
        <Button
          className="w-full"
          disabled={!product.trim() || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              type,
              product: product.trim(),
              audience: audience.trim(),
              tone,
            })
          }
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {mutation.isPending ? "Generando..." : "Generar 3 variantes"}
        </Button>
      </div>

      {mutation.isPending ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : results === null ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-400">
          Completa el formulario y genera tu primer copy
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {results.map((text, i) => (
            <div key={i} className="rounded-xl border border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">Variante {i + 1}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0"
                  aria-label="Copiar variante"
                  onClick={() => copyVariant(text)}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {text}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

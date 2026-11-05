"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Calculator, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const money = (n: number) => `$${n.toFixed(2)}`

export function PricingCalculator() {
  const [costoProducto, setCostoProducto] = useState("10")
  const [costoEnvio, setCostoEnvio] = useState("4")
  const [comision, setComision] = useState("5")
  const [costoAds, setCostoAds] = useState("3")
  const [margen, setMargen] = useState("30")

  const calc = useMemo(() => {
    const toNum = (value: string) => {
      const n = Number.parseFloat(value.replace(",", "."))
      return Number.isFinite(n) ? n : 0
    }
    const productCost = toNum(costoProducto)
    const shippingCost = toNum(costoEnvio)
    const feePct = toNum(comision)
    const adsCost = toNum(costoAds)
    const marginPct = toNum(margen)

    const totalCosts = productCost + shippingCost + adsCost
    const divisor = 1 - (feePct + marginPct) / 100
    const price = divisor > 0.02 ? totalCosts / divisor : null

    if (price === null) {
      return {
        valid: false as const,
        totalCosts,
        divisor,
        feePct,
        marginPct,
        productCost,
        shippingCost,
        adsCost,
      }
    }
    const feeAmount = (price * feePct) / 100
    const ganancia = price - totalCosts - feeAmount
    const margenReal = price > 0 ? (ganancia / price) * 100 : 0
    return {
      valid: true as const,
      price,
      totalCosts,
      divisor,
      feeAmount,
      ganancia,
      margenReal,
      feePct,
      marginPct,
      productCost,
      shippingCost,
      adsCost,
    }
  }, [costoProducto, costoEnvio, comision, costoAds, margen])

  const copySummary = async () => {
    const lines = [
      "Calculadora de Precios — ALQEMIRA",
      `Precio sugerido de venta: ${calc.valid ? money(calc.price) : "—"}`,
      `Costos totales (producto + envío + ads): ${money(calc.totalCosts)}`,
      `Comisión de pasarela (${calc.feePct}%): ${calc.valid ? money(calc.feeAmount) : "—"}`,
      `Utilidad estimada: ${
        calc.valid ? `+${money(calc.ganancia)} (${calc.margenReal.toFixed(0)}%)` : "—"
      }`,
      "Fórmula: Precio = costos / (1 − comisión − margen)",
    ]
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      toast.success("Resumen copiado")
    } catch {
      toast.error("No se pudo copiar el resumen")
    }
  }

  return (
    <Card className="h-full gap-0 rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
          <Calculator className="h-5 w-5 text-amber-600" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold leading-none text-zinc-900">Calculadora de Precios</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Define el precio ideal con margen real
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pc-cost" className="text-xs text-zinc-500">
            Costo del producto $
          </Label>
          <Input
            id="pc-cost"
            type="number"
            inputMode="decimal"
            className="h-9"
            value={costoProducto}
            onChange={(e) => setCostoProducto(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pc-shipping" className="text-xs text-zinc-500">
            Costo de envío $
          </Label>
          <Input
            id="pc-shipping"
            type="number"
            inputMode="decimal"
            className="h-9"
            value={costoEnvio}
            onChange={(e) => setCostoEnvio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pc-fee" className="text-xs text-zinc-500">
            Comisión de pasarela %
          </Label>
          <Input
            id="pc-fee"
            type="number"
            inputMode="decimal"
            className="h-9"
            value={comision}
            onChange={(e) => setComision(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pc-ads" className="text-xs text-zinc-500">
            Costo de ads por venta $
          </Label>
          <Input
            id="pc-ads"
            type="number"
            inputMode="decimal"
            className="h-9"
            value={costoAds}
            onChange={(e) => setCostoAds(e.target.value)}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="pc-margin" className="text-xs text-zinc-500">
            Margen objetivo %
          </Label>
          <Input
            id="pc-margin"
            type="number"
            inputMode="decimal"
            className="h-9"
            value={margen}
            onChange={(e) => setMargen(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-zinc-950 p-5 text-white">
        <p className="text-xs text-zinc-400">Precio sugerido de venta</p>
        <p className="gold-text mt-1 font-display text-3xl font-bold">
          {calc.valid ? money(calc.price) : "—"}
        </p>
        {!calc.valid && (
          <p className="mt-2 text-xs text-amber-400">
            Revisa los porcentajes: la suma de comisión y margen debe ser menor a 100%.
          </p>
        )}
        {calc.valid && (
          <div className="mt-3 space-y-1.5 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-3">
              <span>Costos totales (producto + envío + ads)</span>
              <span className="font-medium text-zinc-100">{money(calc.totalCosts)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Comisión de pasarela</span>
              <span className="font-medium text-zinc-100">{money(calc.feeAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Utilidad estimada</span>
              <span className="font-semibold text-emerald-400">
                +{money(calc.ganancia)} ({calc.margenReal.toFixed(0)}%)
              </span>
            </div>
            <p className="pt-1 text-[11px] text-zinc-500">
              Precio = costos / (1 − comisión − margen)
            </p>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={copySummary}>
        <Copy className="h-4 w-4" aria-hidden />
        Copiar resumen
      </Button>
    </Card>
  )
}

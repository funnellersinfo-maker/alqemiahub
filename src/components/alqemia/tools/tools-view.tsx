"use client"

import type { LucideIcon } from "lucide-react"
import { FolderOpen, Image as ImageIcon, LineChart, Lock, ScanSearch } from "lucide-react"

import { CopyLabTool } from "@/components/alqemia/tools/copylab-tool"
import { PricingCalculator } from "@/components/alqemia/tools/pricing-calculator"
import { Card } from "@/components/ui/card"

type LockedTool = {
  icon: LucideIcon
  title: string
  desc: string
}

const LOCKED_TOOLS: LockedTool[] = [
  {
    icon: ImageIcon,
    title: "Generador de Creativos",
    desc: "Anuncios visuales listos para testear",
  },
  {
    icon: ScanSearch,
    title: "Analizador de Competencia",
    desc: "Espía las ofertas de tu nicho",
  },
  {
    icon: LineChart,
    title: "Tracker de KPIs",
    desc: "Tus métricas diarias en un solo lugar",
  },
  {
    icon: FolderOpen,
    title: "Biblioteca de Plantillas",
    desc: "Fichas, emails y guiones listos para usar",
  },
]

export function ToolsView() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Herramientas</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tu arsenal para crecer más rápido. Iremos agregando más.
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2">
        <PricingCalculator />
        <CopyLabTool />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LOCKED_TOOLS.map((tool) => (
          <Card
            key={tool.title}
            className="relative cursor-not-allowed gap-0 rounded-2xl p-5 opacity-90"
          >
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
              <Lock className="h-3 w-3" aria-hidden />
              Próximamente
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900">
              <tool.icon className="h-5 w-5 text-zinc-300" aria-hidden />
            </div>
            <h3 className="mt-3 font-semibold text-zinc-400">{tool.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{tool.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

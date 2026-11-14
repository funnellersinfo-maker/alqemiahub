"use client"

// ============================================================
// EL ARSENAL — Herramientas de ALQEMIA
// Bienvenida elegante + submenú por categorías para que las
// herramientas no queden sueltas: Copys & Persuasión,
// Precios & Estrategia, Clientes & Contacto.
// ============================================================

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  LineChart,
  Lock,
  MessageCircle,
  ScanSearch,
  Sparkles,
  Wrench,
} from "lucide-react"

import { CopyLabTool } from "@/components/alqemia/tools/copylab-tool"
import { PricingCalculator } from "@/components/alqemia/tools/pricing-calculator"
import { WhalinkTool } from "@/components/alqemia/tools/whalink-tool"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type CategoryKey = "copy" | "strategy" | "contact"

type Category = {
  key: CategoryKey
  title: string
  desc: string
  icon: LucideIcon
  tools: string[]
  soonCount: number
}

const CATEGORIES: Category[] = [
  {
    key: "copy",
    title: "Copys & Persuasión",
    desc: "Textos que venden: frameworks AIDA · PAS · PASTOR, gatillos mentales y neuromarketing.",
    icon: Sparkles,
    tools: ["CopyLab de Élite"],
    soonCount: 2,
  },
  {
    key: "strategy",
    title: "Precios & Estrategia",
    desc: "Números claros para decidir: márgenes, precios de venta y métricas de tu negocio.",
    icon: Calculator,
    tools: ["Calculadora de Precios"],
    soonCount: 2,
  },
  {
    key: "contact",
    title: "Clientes & Contacto",
    desc: "Conecta y convierte por WhatsApp con enlaces cortos y QR de marca.",
    icon: MessageCircle,
    tools: ["Whalink + QR"],
    soonCount: 0,
  },
]

type LockedTool = {
  icon: LucideIcon
  title: string
  desc: string
}

const LOCKED_BY_CATEGORY: Record<CategoryKey, LockedTool[]> = {
  copy: [
    {
      icon: ImageIcon,
      title: "Generador de Creativos",
      desc: "Anuncios visuales listos para publicar",
    },
    {
      icon: FolderOpen,
      title: "Biblioteca de Plantillas",
      desc: "Fichas, emails y guiones listos para usar",
    },
  ],
  strategy: [
    {
      icon: LineChart,
      title: "Tracker de KPIs",
      desc: "Tus métricas diarias en un solo lugar",
    },
    {
      icon: ScanSearch,
      title: "Analizador de Competencia",
      desc: "Espía las ofertas de tu nicho",
    },
  ],
  contact: [],
}

function LockedCard({ tool }: { tool: LockedTool }) {
  return (
    <Card className="relative cursor-not-allowed gap-0 rounded-2xl p-5 opacity-90">
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
  )
}

/** Bienvenida elegante al Arsenal. */
function Welcome({ onOpen }: { onOpen: (key: CategoryKey) => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Hero de bienvenida */}
      <header className="gate-card relative overflow-hidden rounded-3xl p-6 sm:p-10">
        {/* brillo alquímico */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-gold/5 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 ring-1 ring-gold/40 shadow-[0_0_30px_-8px_rgba(212,175,55,0.7)]">
            <Wrench className="h-6 w-6 text-gold-bright" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold/70">
              Bienvenido a
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
              El Arsenal de <span className="text-gold-bright">ALQEMIA</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Tus instrumentos de transmutación: copys de élite, números claros y
              contacto directo con tus clientes. Elige una categoría y forja
              resultados.
            </p>
          </div>
        </div>
      </header>

      {/* Categorías */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => onOpen(cat.key)}
            aria-label={`Abrir categoría ${cat.title}`}
            className="group relative animate-chip-pop overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_10px_40px_-15px_rgba(212,175,55,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold/5 blur-2xl transition-all duration-300 group-hover:bg-gold/15"
            />
            <div className="relative flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30 transition-colors group-hover:bg-gold/20">
                <cat.icon className="h-5 w-5 text-gold-bright" aria-hidden />
              </span>
              <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 text-zinc-500 transition-all group-hover:border-gold/50 group-hover:text-gold-bright">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <h2 className="relative mt-4 font-display text-lg font-semibold text-zinc-100">
              {cat.title}
            </h2>
            <p className="relative mt-1.5 text-sm leading-relaxed text-zinc-500">
              {cat.desc}
            </p>
            <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
              {cat.tools.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold-bright ring-1 ring-inset ring-gold/25"
                >
                  {t}
                </span>
              ))}
              {cat.soonCount > 0 && (
                <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-500 ring-1 ring-inset ring-zinc-800">
                  +{cat.soonCount} próximamente
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Vista interior de una categoría: sus herramientas + bloqueadas. */
function CategoryView({
  category,
  onBack,
}: {
  category: Category
  onBack: () => void
}) {
  const locked = LOCKED_BY_CATEGORY[category.key]
  const Icon = category.icon
  return (
    <div className="mx-auto w-full max-w-5xl">
      <button
        type="button"
        onClick={onBack}
        className="group inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-3.5 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-gold/40 hover:text-gold-bright"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        Todas las categorías
      </button>

      <header className="mt-4 flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/10 ring-1 ring-gold/40">
          <Icon className="h-6 w-6 text-gold-bright" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
            {category.title}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">{category.desc}</p>
        </div>
      </header>

      <div className={cn("mt-5 grid grid-cols-1 gap-4", locked.length > 0 && "sm:grid-cols-2")}>
        {/* Herramienta(s) activa(s) de la categoría */}
        {category.key === "copy" && <CopyLabTool />}
        {category.key === "strategy" && <PricingCalculator />}
        {category.key === "contact" && <WhalinkTool />}

        {locked.map((tool) => (
          <LockedCard key={tool.title} tool={tool} />
        ))}
      </div>
    </div>
  )
}

export function ToolsView() {
  const [category, setCategory] = useState<CategoryKey | null>(null)

  if (category === null) {
    return <Welcome onOpen={setCategory} />
  }

  const cat = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0]
  return <CategoryView category={cat} onBack={() => setCategory(null)} />
}

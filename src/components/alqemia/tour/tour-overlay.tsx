"use client"

// ============================================================
// ALQEMIA — El Mapa del Gremio (tour obligatorio de bienvenida)
// La primera vez que un miembro abre el Hub: burbujas emergentes
// que lo llevan sección por sección con un foco dorado. Cada
// burbuja exige presionar "Continuar" para avanzar y desbloquear;
// al final, +25 XP y el logro "Mapa Descifrado". Solo primera vez.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Crown,
  GraduationCap,
  Home,
  Loader2,
  Map as MapIcon,
  MessageCircle,
  Radio,
  Sparkles,
  Store,
  Trophy,
  User,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAppStore, celebrateXp, type AppView } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { SparkleBurst } from "@/components/alqemia/fx/celebration"
import { cn } from "@/lib/utils"
import type { ApiErrorShape, MeResponse } from "@/lib/types"

// ----------------------------------------------------------------
// Las 7 salas del recorrido (mismo orden que el menú del Hub)
// ----------------------------------------------------------------

type TourSection = {
  key: AppView
  icon: LucideIcon
  title: string
  legend: string
  xp?: string
}

const SECTIONS: TourSection[] = [
  {
    key: "feed",
    icon: Home,
    title: "El Muro",
    legend:
      "El corazón del gremio: aquí todos comparten sus avances, ventas y aprendizajes. Comenta, aporta y hazte visible.",
    xp: "+15 XP por publicación",
  },
  {
    key: "live",
    icon: Radio,
    title: "En Vivo",
    legend:
      "Las transmisiones en directo del maestre. Cuando el punto rojo titile en el menú, el oro está fluyendo ahora mismo.",
  },
  {
    key: "classroom",
    icon: GraduationCap,
    title: "Classroom",
    legend:
      "Los programas grabados de ALQEMIA, lección a lección. Marca cada lección vista y avanza a tu ritmo.",
    xp: "+25 XP por lección · +50 por programa dominado",
  },
  {
    key: "market",
    icon: Store,
    title: "Marketplace",
    legend:
      "El mercado interno: micro apps y productos de los propios miembros. Publica el tuyo o áliate y gana comisiones por revender.",
  },
  {
    key: "tools",
    icon: Wrench,
    title: "Herramientas",
    legend:
      "Tus armas de trabajo: el laboratorio de copys de élite (AIDA/PAS con neuromarketing), la calculadora de precios y el acortador Walinks.",
  },
  {
    key: "ai",
    icon: Sparkles,
    title: "El Oráculo (IA)",
    legend:
      "Tu consultor personal de marketing y ecommerce, entrenado para ayudarte 24/7. Pregúntale lo que quieras.",
  },
  {
    key: "profile",
    icon: User,
    title: "Tu Perfil",
    legend:
      "Tu identidad alquímica: rango actual, XP, logros desbloqueados y tu posición en el ranking del gremio.",
    xp: "Completa tu perfil: +100 XP",
  },
]

const TOTAL_STEPS = SECTIONS.length + 2 // bienvenida + 7 salas + final

// ----------------------------------------------------------------
// Posicionamiento del foco y la burbuja
// ----------------------------------------------------------------

type Rect = { top: number; left: number; width: number; height: number; side: "left" | "bottom" }

function findVisibleTarget(key: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)
  for (const node of nodes) {
    // Visible = con tamaño y no oculto por display:none
    if (node.offsetParent !== null || node.getClientRects().length > 0) return node
  }
  return null
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  const isMobile = window.innerWidth < 1024
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    side: isMobile ? "bottom" : "left",
  }
}

export function TourOverlay({ userName }: { userName: string }) {
  const setView = useAppStore((s) => s.setView)
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0) // 0 = bienvenida · 1..7 = salas · 8 = final
  const [rect, setRect] = useState<Rect | null>(null)
  const [finishing, setFinishing] = useState(false)
  const firstName = userName.split(" ")[0] || "Alquimista"

  const isWelcome = step === 0
  const isFinal = step === TOTAL_STEPS - 1
  const section: TourSection | null = !isWelcome && !isFinal ? SECTIONS[step - 1] : null

  // Congela el scroll del fondo mientras el tour está activo
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const measure = useCallback(() => {
    if (!section) {
      setRect(null)
      return
    }
    const el = findVisibleTarget(section.key)
    setRect(el ? rectOf(el) : null)
  }, [section])

  useLayoutEffect(() => {
    // Medir en el siguiente frame (evita setState síncrono dentro del efecto)
    const raf = requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [measure])

  // Al entrar a cada sala del recorrido, la sección real se muestra detrás
  useEffect(() => {
    if (section) setView(section.key)
  }, [section, setView])

  async function handleFinal() {
    setFinishing(true)
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourCompleted: true }),
      })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as ApiErrorShape | null
        toast.error(errorData?.error ?? "No se pudo registrar tu recorrido")
        setFinishing(false)
        return
      }
      const data = (await res.json()) as MeResponse
      celebrateXp(data.xp ?? null)
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      // Pequeño festejo antes de liberar el Hub
      setTimeout(() => setFinishing(false), 900)
    } catch {
      toast.error("No se pudo registrar tu recorrido. Intenta de nuevo.")
      setFinishing(false)
    }
  }

  // ----------------------------------------------------------------
  // Burbuja
  // ----------------------------------------------------------------

  // Medidas del viewport (la burbuja se recoloca al cambiar de paso)
  const vw = typeof window === "undefined" ? 390 : window.innerWidth
  const vh = typeof window === "undefined" ? 844 : window.innerHeight
  const bubbleW = Math.min(360, vw - 32)

  const bubbleStyle: React.CSSProperties = rect
    ? rect.side === "left"
      ? {
          // Desktop: a la derecha del ítem del menú lateral
          top: Math.max(16, Math.min(rect.top - 24, vh - 380)),
          left: rect.left + rect.width + 20,
        }
      : {
          // Móvil: anclada por su borde inferior justo encima de la tab bar
          bottom: vh - rect.top + 16,
          left: Math.max(12, Math.min(rect.left + rect.width / 2 - bubbleW / 2, vw - bubbleW - 12)),
        }
    : {}

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Recorrido de bienvenida por el Hub"
    >
      {/* Velo oscuro (el foco lo perfora con su sombra) */}
      <div
        className={cn(
          "absolute inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity duration-500",
          rect ? "bg-transparent backdrop-blur-none" : ""
        )}
        onClick={(e) => e.preventDefault()}
      />

      {/* El foco dorado sobre la sección actual */}
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl border-2 border-gold shadow-[0_0_0_200vmax_rgba(0,0,0,0.78),0_0_30px_-4px_rgba(217,164,65,0.55)] transition-all duration-500 ease-out"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        >
          <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-gold-bright" />
          </span>
        </div>
      )}

      {/* ============ BURBUJA ============ */}
      <div
        key={step}
        className={cn(
          "gate-card thin-scrollbar animate-portal-in z-10 max-h-[78dvh] w-[calc(100vw-32px)] max-w-[360px] overflow-y-auto p-5",
          !rect && "left-1/2 top-1/2 max-w-md -translate-x-1/2 -translate-y-1/2"
        )}
        // position:absolute inline: .gate-card define position:relative sin capa
        // y en Tailwind v4 el CSS sin capa pisa las utilidades. El centrado usa
        // la propiedad translate (clases TW4), que compone con la animación.
        style={{ position: "absolute", ...bubbleStyle }}
      >
        {/* ---- Bienvenida ---- */}
        {isWelcome && (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40 shadow-[0_0_36px_-8px_rgba(217,164,65,0.7)]">
              <MapIcon className="h-7 w-7 text-gold-bright" aria-hidden="true" />
            </span>
            <h2 className="font-display mt-4 text-xl tracking-tight text-zinc-100">
              Bienvenido al gremio, {firstName}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Antes de dejarte libre, recorreremos juntos el{" "}
              <span className="font-semibold text-gold-bright">mapa del Hub</span>: 7 salas te esperan
              detrás de esta burbuja.
            </p>
            <div className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.06] p-2.5 text-xs leading-relaxed text-zinc-400">
              <span className="font-semibold text-gold-bright">Regla del gremio:</span> presiona el
              botón dorado de cada burbuja para avanzar y desbloquear cada sala. Al final te espera
              una recompensa.
            </div>
            <Button type="button" className="btn-gold mt-5 h-11 w-full font-bold" onClick={() => setStep(1)}>
              Comenzar el recorrido
            </Button>
          </div>
        )}

        {/* ---- Secciones ---- */}
        {section && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-bright">
                <MapIcon className="h-3 w-3" aria-hidden="true" />
                Sala {step} de {SECTIONS.length}
              </span>
              <span className="text-[11px] text-zinc-500">
                {step}/{TOTAL_STEPS - 2}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
                <section.icon className="h-5 w-5 text-gold" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg leading-tight tracking-tight text-zinc-100">
                {section.title}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{section.legend}</p>
            {section.xp && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.07] px-3 py-1 text-xs font-semibold text-gold-bright">
                <Zap className="h-3.5 w-3.5 fill-gold text-gold-deep" aria-hidden="true" />
                {section.xp}
              </div>
            )}
            <Button
              type="button"
              className="btn-gold mt-5 h-11 w-full font-bold"
              onClick={() => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))}
            >
              Continuar
              <span className="ml-1 text-xs font-medium opacity-80">
                {step < SECTIONS.length ? "desbloquear sala" : "última"}
              </span>
            </Button>
          </div>
        )}

        {/* ---- Final ---- */}
        {isFinal && (
          <div className="relative text-center">
            {finishing ? (
              <div className="relative flex flex-col items-center py-6" aria-live="polite">
                <SparkleBurst count={26} distance={120} />
                <div className="animate-portal-in flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40 shadow-[0_0_50px_-6px_rgba(217,164,65,0.7)]">
                  <Crown className="h-10 w-10 text-gold-bright" aria-hidden="true" />
                </div>
                <p className="font-display gold-text animate-fade-up mt-5 text-2xl font-bold tracking-[0.15em] [animation-delay:0.1s]">
                  HUB DESBLOQUEADO
                </p>
                <p className="animate-fade-up mt-2 text-sm text-zinc-500 [animation-delay:0.25s]">
                  El gremio es todo tuyo, {firstName}.
                </p>
              </div>
            ) : (
              <>
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40 shadow-[0_0_36px_-8px_rgba(217,164,65,0.7)]">
                  <Trophy className="h-7 w-7 text-gold-bright" aria-hidden="true" />
                </span>
                <h2 className="font-display mt-4 text-xl tracking-tight text-zinc-100">
                  ¡Mapa descifrado, {firstName}!
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Recorriste las 7 salas del gremio. Reclama tu recompensa y queda libre para
                  transmutar lo que quieras.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/[0.07] px-3 py-1 text-xs font-semibold text-gold-bright">
                    <Zap className="h-3.5 w-3.5 fill-gold text-gold-deep" aria-hidden="true" />
                    +25 XP
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/[0.07] px-3 py-1 text-xs font-semibold text-gold-bright">
                    <MessageCircle className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    Logro: Mapa Descifrado
                  </span>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="btn-gold mt-5 h-12 w-full text-base font-bold"
                  onClick={() => void handleFinal()}
                >
                  Reclamar y entrar libre
                </Button>
              </>
            )}
          </div>
        )}

        {/* Rastro del recorrido (puntos) */}
        <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-5 bg-gold" : i < step ? "w-1.5 bg-gold/60" : "w-1.5 bg-zinc-700"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

"use client"

// ============================================================
// ALQEMIA — KineticWordmark
// El nombre con la LETRA PROPIA de la marca (trazos SVG:
// A sin barra, E como Ξ, Q con cola, M puntiaguda), entrada
// escalonada y barrido periódico de brillo sobre el oro.
// ============================================================

import { Sparkle } from "lucide-react"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"
import { cn } from "@/lib/utils"

export function KineticWordmark({
  className,
  delay = 0.2,
}: {
  className?: string
  /** Retardo inicial (s) para orquestar con el resto de la escena */
  delay?: number
}) {
  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      role="img"
      aria-label="ALQEMIA"
    >
      <AlqemiaLetters
        text="ALQEMIA"
        animate
        delay={delay}
        shine
        glow
        strokeWidth={7.5}
      />
      {/* Destello final */}
      <Sparkle
        aria-hidden="true"
        className="animate-sparkle-pop absolute -right-3 top-0 h-3 w-3 text-gold-bright"
        style={{ animationDelay: `${delay + 0.62}s` }}
      />
    </span>
  )
}

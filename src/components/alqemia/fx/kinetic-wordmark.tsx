"use client"

// ============================================================
// ALQEMIA — KineticWordmark
// El nombre letra por letra con entrada escalonada y un
// barrido de brillo periódico sobre el oro.
// ============================================================

import { Sparkle } from "lucide-react"
import { cn } from "@/lib/utils"

const WORD = "ALQEMIA"

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
      className={cn("brand-wordmark shine-sweep relative inline-flex pl-[0.38em]", className)}
      aria-label="ALQEMIA"
    >
      {WORD.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="animate-letter-in inline-block"
          style={{ animationDelay: `${delay + i * 0.07}s` }}
        >
          {ch}
        </span>
      ))}
      {/* Destello final */}
      <Sparkle
        aria-hidden="true"
        className="animate-sparkle-pop absolute -right-5 top-0 h-3.5 w-3.5 text-gold-bright"
        style={{ animationDelay: `${delay + WORD.length * 0.07 + 0.1}s` }}
      />
    </span>
  )
}

"use client"

// ============================================================
// ALQEMIA — Efectos de celebración
// SparkleBurst: explosión radial de chispas doradas.
// CountUp: contador animado (para los +XP).
// ============================================================

import { useEffect, useState, type CSSProperties } from "react"
import { cn } from "@/lib/utils"

export function SparkleBurst({
  count = 18,
  distance = 96,
  className,
}: {
  count?: number
  distance?: number
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360
        const size = i % 3 === 0 ? "h-2 w-2" : "h-1.5 w-1.5"
        return (
          <span
            key={i}
            className={cn("animate-sparkle absolute rounded-full bg-gold-bright", size)}
            style={
              {
                "--spark-angle": `${angle}deg`,
                "--spark-dist": `${distance}px`,
                animationDelay: `${(i % 6) * 55}ms`,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

export function CountUp({
  value,
  duration = 950,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      const id = requestAnimationFrame(() => setDisplay(value))
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className={className}>{display.toLocaleString("es")}</span>
}

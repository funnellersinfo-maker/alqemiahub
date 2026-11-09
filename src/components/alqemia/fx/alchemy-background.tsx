"use client"

// ============================================================
// ALQEMIA — AlchemyBackground
// Fondo vivo de la marca: polvo de oro (canvas) que asciende,
// auroras doradas a la deriva y retícula alquímica sutil.
// Respeta prefers-reduced-motion (sin canvas, auroras estáticas).
// ============================================================

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

type Particle = {
  x: number
  y: number
  r: number
  vy: number
  phase: number
  alpha: number
}

export function AlchemyBackground({
  density = 1,
  className,
}: {
  /** Multiplicador de partículas de polvo de oro (0.4 sutil · 1.2 héroe) */
  density?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const ctx = canvas.getContext("2d")
    if (!ctx || reduced) return

    let raf = 0
    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const count = Math.max(10, Math.round(44 * density))
    const particles: Particle[] = []

    const spawn = (anywhere = false): Particle => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 12,
      r: 0.5 + Math.random() * 1.7,
      vy: 0.12 + Math.random() * 0.42,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.12 + Math.random() * 0.45,
    })

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, w * dpr)
      canvas.height = Math.max(1, h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    for (let i = 0; i < count; i++) particles.push(spawn(true))

    let t = 0
    const tick = () => {
      t += 0.008
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.y -= p.vy
        if (p.y < -14) Object.assign(p, spawn())
        const x = p.x + Math.sin(t * 2 + p.phase) * 7
        const twinkle = 0.55 + 0.45 * Math.sin(t * 3 + p.phase * 2)
        ctx.beginPath()
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(217, 164, 65, ${p.alpha * twinkle})`
        ctx.shadowColor = "rgba(247, 217, 122, 0.9)"
        ctx.shadowBlur = 7
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(tick)
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [density])

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* Auroras de oro líquido a la deriva */}
      <div className="alchemy-aurora" />
      {/* Polvo de oro ascendente */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Retícula alquímica */}
      <div className="alchemy-grid" />
      {/* Viñeta */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_95%_at_50%_0%,transparent_42%,#050505_100%)]" />
    </div>
  )
}

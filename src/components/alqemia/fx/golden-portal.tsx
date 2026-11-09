"use client"

// ============================================================
// ALQEMIA — GoldenPortal
// La Primera Puerta: el sello del logo dentro de anillos
// concéntricos que orbitan, con polvo dorado y respiración.
// ============================================================

import { cn } from "@/lib/utils"

export function GoldenPortal({
  size = 180,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn("animate-portal-in relative shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Halo que respira */}
      <div
        className="animate-portal-breath absolute left-1/2 top-1/2 h-[118%] w-[118%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(217,164,65,0.20) 0%, rgba(184,122,42,0.10) 42%, transparent 68%)",
        }}
      />

      {/* Anillo exterior giratorio (segmentado) */}
      <div className="animate-spin-slower absolute inset-0 rounded-full border border-dashed border-gold/35">
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-bright shadow-[0_0_10px_2px_rgba(247,217,122,0.65)]" />
      </div>

      {/* Anillo intermedio en reversa con dos orbitales */}
      <div className="animate-spin-slow-reverse absolute inset-[9%] rounded-full border border-gold/20">
        <span className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_8px_1px_rgba(217,164,65,0.7)]" />
        <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-gold-deep shadow-[0_0_6px_1px_rgba(184,122,42,0.7)]" />
      </div>

      {/* Núcleo: el sello */}
      <div className="absolute left-1/2 top-1/2 flex h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-zinc-900 to-black shadow-[0_0_50px_rgba(217,164,65,0.30),inset_0_0_24px_rgba(217,164,65,0.12)] ring-1 ring-gold/40">
        <img
          src="/images/logo-mark.png"
          alt=""
          draggable={false}
          className="h-[82%] w-[82%] rounded-full object-cover"
        />
        {/* Brillo especular que barre el núcleo */}
        <div className="animate-specular absolute inset-0 rounded-full" />
      </div>
    </div>
  )
}

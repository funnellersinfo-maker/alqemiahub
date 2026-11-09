"use client"

// ============================================================
// ALQEMIA — Marquee
// Cinta de texto infinita estilo códice alquímico.
// ============================================================

import { cn } from "@/lib/utils"

function MarqueeRow({ items }: { items: string[] }) {
  return (
    <div className="flex shrink-0 items-center gap-10 pr-10">
      {items.map((item, i) => (
        <span
          key={i}
          className="flex items-center gap-10 text-[11px] font-semibold tracking-[0.32em] text-gold/75"
        >
          {item}
          <span aria-hidden="true" className="text-gold-bright">
            ✦
          </span>
        </span>
      ))}
    </div>
  )
}

export function Marquee({
  items,
  className,
}: {
  items: string[]
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "marquee-mask relative w-full overflow-hidden border-y border-gold/15 bg-zinc-950/70 py-2.5 backdrop-blur-sm",
        className
      )}
    >
      <div className="animate-marquee flex w-max">
        <MarqueeRow items={items} />
        <MarqueeRow items={items} />
      </div>
    </div>
  )
}

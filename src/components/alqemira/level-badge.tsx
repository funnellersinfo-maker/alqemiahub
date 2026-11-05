"use client"

import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LevelInfo } from "@/lib/types"

export function LevelBadge({
  level,
  className,
}: {
  level: LevelInfo
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[11px] font-semibold text-zinc-950 shadow-sm whitespace-nowrap",
        className
      )}
    >
      <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
      <span>Nv {level.level} · {level.name}</span>
    </span>
  )
}

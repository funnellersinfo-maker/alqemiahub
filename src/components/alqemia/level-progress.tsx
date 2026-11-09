"use client"

import { cn } from "@/lib/utils"
import type { LevelInfo } from "@/lib/types"

export function LevelProgress({
  level,
  className,
}: {
  level: LevelInfo
  className?: string
}) {
  const label =
    level.nextLevelXp !== null && level.xpToNext !== null
      ? `${level.xpToNext} XP para subir`
      : "Nivel máximo alcanzado"

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
        <span className="font-medium text-zinc-300">
          Nivel {level.level} · {level.name}
        </span>
        <span>{label}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-gold-deep transition-all duration-500"
          style={{ width: `${level.progressPct}%` }}
        />
      </div>
    </div>
  )
}

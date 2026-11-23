"use client"

import { useEffect } from "react"
import { Zap, Crown, Award, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore, type XpToastItem } from "@/lib/store"

const DURATION_MS = 4200
const DURATION_EVALUADOR_MS = 8000

function ToastItem({ item }: { item: XpToastItem }) {
  const dismiss = useAppStore((s) => s.dismissXpToast)

  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.kind === "evaluador" ? DURATION_EVALUADOR_MS : DURATION_MS)
    return () => clearTimeout(t)
  }, [item.id, item.kind, dismiss])

  const base =
    "pointer-events-auto flex items-center gap-2 shadow-lg animate-toast-in select-none max-w-[92vw]"

  if (item.kind === "xp") {
    return (
      <button
        onClick={() => dismiss(item.id)}
        className={cn(base, "rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-gold-bright hover:bg-zinc-900 transition-colors")}
      >
        <Zap className="h-4 w-4 text-gold fill-gold" aria-hidden />
        {item.title}
      </button>
    )
  }

  if (item.kind === "levelup") {
    return (
      <button
        onClick={() => dismiss(item.id)}
        className={cn(base, "rounded-full bg-gradient-to-r from-gold to-gold-deep px-5 py-2.5 text-sm font-bold text-zinc-950 hover:brightness-105 transition")}
      >
        <Crown className="h-4 w-4 fill-zinc-950" aria-hidden />
        {item.title}
      </button>
    )
  }

  if (item.kind === "evaluador") {
    return (
      <button
        onClick={() => dismiss(item.id)}
        className={cn(
          base,
          "flex-col items-start gap-1 rounded-2xl border bg-zinc-950/95 px-4 py-3 text-left backdrop-blur border-gold-bright/60 hover:bg-gold/10 transition-colors max-w-md"
        )}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-gold-bright">
          <FlaskConical className="h-4 w-4 shrink-0 text-gold-deep" aria-hidden />
          {item.title}
        </span>
        {item.subtitle && (
          <span className="text-xs font-semibold text-gold">{item.subtitle}</span>
        )}
        {item.lines && item.lines.length > 0 && (
          <span className="flex w-full flex-col gap-0.5 border-t border-gold/20 pt-1.5">
            {item.lines.map((line, i) => (
              <span key={i} className="text-[11px] leading-snug text-zinc-300">
                {line}
              </span>
            ))}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={() => dismiss(item.id)}
      className={cn(base, "rounded-xl border bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-100 border-gold-bright/60 hover:bg-gold/10 transition-colors")}
    >
      <Award className="h-4 w-4 text-gold-deep" aria-hidden />
      <span className="flex flex-col items-start">
        <span className="font-semibold leading-tight">{item.title}</span>
        {item.subtitle && <span className="text-xs text-zinc-500 leading-tight">{item.subtitle}</span>}
      </span>
    </button>
  )
}

/** Stack global de toasts de gamificación (+XP, niveles, logros) */
export function XpToaster() {
  const xpToasts = useAppStore((s) => s.xpToasts)
  if (xpToasts.length === 0) return null

  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 pointer-events-none px-4 w-fit"
      role="status"
      aria-live="polite"
    >
      {xpToasts.map((t) => (
        <ToastItem key={t.id} item={t} />
      ))}
    </div>
  )
}

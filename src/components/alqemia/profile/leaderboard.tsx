"use client"

// ============================================================
// ALQEMIA — Ranking de Alquimistas
// Top 10 por XP con chulito azul verificado y filas clicables
// que abren el perfil público. Al final: cómo se alcanza cada
// rango y cómo se gana XP (valores reales del motor).
// ============================================================

import { useQuery } from "@tanstack/react-query"
import {
  BadgeCheck,
  BookOpen,
  FlaskConical,
  Map,
  Megaphone,
  MessageCircle,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { LeaderboardEntry } from "@/lib/types"
import { LEVELS } from "@/lib/levels"
import { isVerifiedUser } from "@/lib/profile"
import { useMe } from "@/hooks/use-me"
import { cn } from "@/lib/utils"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { UserAvatar } from "@/components/alqemia/avatar"

async function fetchLeaderboard(): Promise<{ top: LeaderboardEntry[] }> {
  const res = await fetch("/api/leaderboard")
  if (!res.ok) throw new Error("No se pudo cargar el ranking")
  return res.json()
}

function rankClasses(rank: number): string {
  if (rank === 1) return "bg-gold text-zinc-950"
  if (rank === 2) return "bg-zinc-300 text-zinc-200"
  if (rank === 3) return "bg-gold-shadow/80 text-white"
  return "text-zinc-400"
}

/**
 * Valores reales del motor de gamificación (XP_REWARDS en
 * @/lib/gamification, lado servidor). No se importa directamente
 * porque ese módulo persiste en BD; mantener en sincronía.
 */
const XP_GUIDE: { icon: LucideIcon; label: string; value: string; note?: string }[] = [
  { icon: Megaphone, label: "Publicar en el muro", value: "+15" },
  { icon: MessageCircle, label: "Comentar", value: "+5" },
  { icon: BookOpen, label: "Completar una lección", value: "+25", note: "bonus +50 al terminar un programa" },
  { icon: Sparkles, label: "Perfil completo", value: "+100" },
  { icon: Map, label: "Tour del gremio", value: "+25" },
]

/** XP extra por reportar evidencia (lo añade el motor al publicar) */
const REPORT_XP = 25

export function Leaderboard({
  onOpenProfile,
}: {
  onOpenProfile?: (id: string) => void
}) {
  const { data: me } = useMe()
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
  })
  const entries = data?.top ?? []
  const myId = me?.user.id

  return (
    <Card className="min-w-0 gap-0 rounded-2xl p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <Trophy className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="min-w-0 text-base leading-tight sm:text-lg">
            <AlqemiaLetters text="Ranking de Alquimistas" strokeWidth={9} />
          </h2>
          <p className="text-xs text-zinc-500">Top 10 miembros por XP</p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-6 text-center text-xs text-zinc-400">
          Aún no hay alquimistas en el ranking.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-zinc-800">
          {entries.map((entry, i) => {
            const rank = i + 1
            const isMe = entry.id === myId
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenProfile?.(entry.id)}
                aria-label={`Ver perfil de ${entry.name}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors -mx-2",
                  isMe ? "bg-gold/10" : "hover:bg-gold/5"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    rankClasses(rank)
                  )}
                >
                  {rank}
                </div>
                <UserAvatar user={entry} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">
                    <span className="truncate">{entry.name}</span>
                    {isVerifiedUser(entry) ? (
                      <BadgeCheck
                        className="h-4 w-4 shrink-0 fill-sky-400 text-zinc-950"
                        aria-label="Cuenta verificada"
                      />
                    ) : null}
                    {isMe ? (
                      <span className="text-xs font-semibold text-gold">(tú)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400">
                    Nv {entry.level.level} · {entry.level.name}
                  </p>
                </div>
                <Zap className="h-3.5 w-3.5 shrink-0 text-gold-deep" aria-hidden />
                <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-100">
                  {entry.xp}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ---- Cómo se alcanza cada rango ---- */}
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-5">
        <h3 className="min-w-0 text-base sm:text-lg">
          <AlqemiaLetters text="Cómo se alcanza cada rango" strokeWidth={9} />
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Los 8 rangos del gremio se suben con XP acumulado
        </p>

        <div className="mt-4 space-y-1.5">
          {LEVELS.map((l) => {
            const elite = l.level >= 7 // Gran Maestre y Leyenda
            return (
              <div
                key={l.level}
                className="flex flex-col gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <p className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-gold-deep">
                    {l.level}
                  </span>
                  <span className="truncate text-sm font-semibold text-zinc-100">
                    {l.name}
                  </span>
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-2 pl-6 sm:justify-end sm:pl-0">
                  <span className="text-xs tabular-nums text-zinc-400">
                    desde {l.min} XP
                  </span>
                  {elite ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold-bright ring-1 ring-gold/40">
                      <BadgeCheck
                        className="h-3 w-3 fill-sky-400 text-zinc-950"
                        aria-hidden
                      />
                      Chulito azul verificado
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <h4 className="mt-6 font-display text-sm font-semibold text-zinc-100">
          Cómo se gana XP
        </h4>
        <ul className="mt-3 space-y-1.5">
          {XP_GUIDE.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <row.icon className="h-4 w-4 shrink-0 text-gold-deep" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-zinc-200">
                    {row.label}
                  </span>
                  {row.note ? (
                    <span className="block text-[10px] text-zinc-500">{row.note}</span>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-gold-bright">
                {row.value} XP
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/10 p-3">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright" aria-hidden />
          <p className="text-xs leading-relaxed text-gold-bright">
            <span className="font-semibold">
              Reportar resultados al publicar +{REPORT_XP} XP
            </span>{" "}
            — la evidencia es lo que hace destacar tu perfil
          </p>
        </div>
      </div>
    </Card>
  )
}

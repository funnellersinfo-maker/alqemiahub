"use client"

import { useQuery } from "@tanstack/react-query"
import { Trophy, Zap } from "lucide-react"

import type { LeaderboardEntry } from "@/lib/types"
import { useMe } from "@/hooks/use-me"
import { cn } from "@/lib/utils"
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

export function Leaderboard() {
  const { data: me } = useMe()
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
  })
  const entries = data?.top ?? []
  const myId = me?.user.id

  return (
    <Card className="gap-0 rounded-2xl p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <Trophy className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold leading-tight text-zinc-100">
            Ranking de Alquimistas
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
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  isMe && "rounded-lg bg-gold/10 px-2 -mx-2"
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
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {entry.name}
                    {isMe ? (
                      <span className="ml-1.5 text-xs font-semibold text-gold">(tú)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400">
                    Nv {entry.level.level} · {entry.level.name}
                  </p>
                </div>
                <Zap className="h-3.5 w-3.5 shrink-0 text-gold-deep" aria-hidden />
                <span className="shrink-0 text-sm font-semibold text-zinc-100">{entry.xp}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

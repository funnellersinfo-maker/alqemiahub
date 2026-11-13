"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Award,
  BookOpen,
  FlaskConical,
  Footprints,
  LogOut,
  Megaphone,
  MessageCircle,
  Pencil,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useMe } from "@/hooks/use-me"
import { useAppStore } from "@/lib/store"
import { ACHIEVEMENTS } from "@/lib/levels"
import { completionChecklist, profileCompletion } from "@/lib/profile"
import { formatDate, timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AliadosSection } from "@/components/alqemia/profile/aliados-section"
import { Skeleton } from "@/components/ui/skeleton"
import { LevelBadge } from "@/components/alqemia/level-badge"
import { LevelProgress } from "@/components/alqemia/level-progress"
import { UserAvatar } from "@/components/alqemia/avatar"
import { EditProfileDialog } from "./edit-profile-dialog"
import { Leaderboard } from "./leaderboard"

/** Icono lucide asociado a cada logro (ACHIEVEMENTS[code].icon) */
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  FlaskConical,
  Megaphone,
  MessageCircle,
  Footprints,
  BookOpen,
  Trophy,
}

export function ProfileView() {
  const { data, isLoading } = useMe()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const user = data?.user

  function handleSignOut() {
    useAppStore.getState().reset()
    void queryClient.clear()
    void signOut({ callbackUrl: "/" })
  }

  if (isLoading || !user) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card className="gap-0 overflow-hidden rounded-2xl p-0">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="space-y-4 p-5 sm:p-6">
            <Skeleton className="-mt-12 h-24 w-24 rounded-full ring-4 ring-white" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        </Card>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="gap-0 overflow-hidden rounded-2xl p-0">
        {/* Portada */}
        <div className="h-28 bg-gradient-to-r from-zinc-950 via-zinc-800 to-gold-shadow" />

        <div className="p-5 pt-0 sm:p-6 sm:pt-0">
          <UserAvatar user={user} size="2xl" className="-mt-12 ring-4 ring-white" />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-zinc-100">{user.name}</h1>
            <LevelBadge level={user.level} />
          </div>
          {user.headline ? (
            <p className="mt-1 text-sm text-zinc-500">{user.headline}</p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-400">
            Miembro desde {formatDate(user.createdAt)} · {user.level.currentXp} XP totales
          </p>

          <LevelProgress level={user.level} className="mt-4" />

          {/* Completitud del perfil */}
          {(() => {
            const completion = profileCompletion(user)
            const missing = completionChecklist(user).filter((c) => !c.done)
            return (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Perfil completado
                  </p>
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      completion === 100 ? "gold-text" : "text-zinc-300"
                    )}
                  >
                    {completion}%
                  </p>
                </div>
                <Progress
                  value={completion}
                  className="mt-2 h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-gold [&>div]:to-gold-deep"
                />
                {completion < 100 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500">Falta:</span>
                    {missing.map((m) => (
                      <span
                        key={m.label}
                        className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        {m.label}
                      </span>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-gold hover:text-gold-bright"
                      onClick={() => setEditing(true)}
                    >
                      Completar
                    </Button>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
              <Zap className="mx-auto h-4 w-4 text-gold-deep" aria-hidden />
              <p className="mt-1.5 font-semibold text-zinc-100">{user.level.currentXp} XP</p>
              <p className="text-[11px] text-zinc-500">Experiencia</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
              <Award className="mx-auto h-4 w-4 text-gold-deep" aria-hidden />
              <p className="mt-1.5 font-semibold text-zinc-100">{user.achievements.length} logros</p>
              <p className="text-[11px] text-zinc-500">Logros</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
              <Trophy className="mx-auto h-4 w-4 text-gold-deep" aria-hidden />
              <p className="mt-1.5 font-semibold text-zinc-100">Nv {user.level.level}</p>
              <p className="text-[11px] text-zinc-500">Nivel actual</p>
            </div>
          </div>

          {(user.bio || user.goal) && (
            <div className="mt-5">
              {user.bio ? (
                <div>
                  <Label className="text-xs text-zinc-400">Sobre mí</Label>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{user.bio}</p>
                </div>
              ) : null}
              {user.goal ? (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold-bright/60 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-bright">
                  <Target className="h-3.5 w-3.5" aria-hidden />
                  {user.goal}
                </span>
              ) : null}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Editar perfil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={handleSignOut}
            >
              <LogOut aria-hidden />
              Cerrar sesión
            </Button>
          </div>

          {/* Logros */}
          <div className="mt-6">
            <h2 className="font-display text-lg font-semibold text-zinc-100">Logros</h2>
            <p className="text-xs text-zinc-500">Tu colección de transmutaciones</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(ACHIEVEMENTS).map(([code, achievement]) => {
                const unlocked = user.achievements.find((a) => a.code === code)
                const Icon = ICONS[achievement.icon] ?? Sparkles
                return (
                  <Card
                    key={code}
                    className={cn(
                      "flex-row items-center gap-3 rounded-2xl p-3.5",
                      unlocked ? "border-gold-bright/60 bg-gold/10" : "opacity-70"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        unlocked ? "bg-gold/20 text-gold" : "bg-zinc-900 text-zinc-300"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight",
                          unlocked ? "text-zinc-100" : "text-zinc-400"
                        )}
                      >
                        {achievement.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {unlocked ? `Obtenido · ${timeAgo(unlocked.createdAt)}` : "Bloqueado"}
                      </p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <AliadosSection />
      </div>

      <div className="mt-6">
        <Leaderboard />
      </div>

      <EditProfileDialog open={editing} onOpenChange={setEditing} />
    </div>
  )
}

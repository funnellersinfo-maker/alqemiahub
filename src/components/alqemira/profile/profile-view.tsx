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
import { formatDate, timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { LevelBadge } from "@/components/alqemira/level-badge"
import { LevelProgress } from "@/components/alqemira/level-progress"
import { UserAvatar } from "@/components/alqemira/avatar"
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
        <div className="h-28 bg-gradient-to-r from-zinc-950 via-zinc-800 to-amber-800" />

        <div className="p-5 pt-0 sm:p-6 sm:pt-0">
          <UserAvatar user={user} size="2xl" className="-mt-12 ring-4 ring-white" />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-zinc-900">{user.name}</h1>
            <LevelBadge level={user.level} />
          </div>
          {user.headline ? (
            <p className="mt-1 text-sm text-zinc-500">{user.headline}</p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-400">
            Miembro desde {formatDate(user.createdAt)} · {user.level.currentXp} XP totales
          </p>

          <LevelProgress level={user.level} className="mt-4" />

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 text-center">
              <Zap className="mx-auto h-4 w-4 text-amber-500" aria-hidden />
              <p className="mt-1.5 font-semibold text-zinc-900">{user.level.currentXp} XP</p>
              <p className="text-[11px] text-zinc-500">Experiencia</p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 text-center">
              <Award className="mx-auto h-4 w-4 text-amber-500" aria-hidden />
              <p className="mt-1.5 font-semibold text-zinc-900">{user.achievements.length} logros</p>
              <p className="text-[11px] text-zinc-500">Logros</p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 text-center">
              <Trophy className="mx-auto h-4 w-4 text-amber-500" aria-hidden />
              <p className="mt-1.5 font-semibold text-zinc-900">Nv {user.level.level}</p>
              <p className="text-[11px] text-zinc-500">Nivel actual</p>
            </div>
          </div>

          {(user.bio || user.goal) && (
            <div className="mt-5">
              {user.bio ? (
                <div>
                  <Label className="text-xs text-zinc-400">Sobre mí</Label>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{user.bio}</p>
                </div>
              ) : null}
              {user.goal ? (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
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
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleSignOut}
            >
              <LogOut aria-hidden />
              Cerrar sesión
            </Button>
          </div>

          {/* Logros */}
          <div className="mt-6">
            <h2 className="font-display text-lg font-semibold text-zinc-900">Logros</h2>
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
                      unlocked ? "border-amber-200 bg-amber-50/40" : "opacity-70"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        unlocked ? "bg-amber-100 text-amber-600" : "bg-zinc-50 text-zinc-300"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight",
                          unlocked ? "text-zinc-900" : "text-zinc-400"
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
        <Leaderboard />
      </div>

      <EditProfileDialog open={editing} onOpenChange={setEditing} />
    </div>
  )
}

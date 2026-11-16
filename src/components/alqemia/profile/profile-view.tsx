"use client"

// ============================================================
// ALQEMIA — Perfil (propio y público)
// Sin `userId` muestra MI perfil (useMe). Con `userId` consulta
// /api/users/:id y muestra la versión pública del miembro.
// Portada 16:9, chulito azul verificado, resultados reportados,
// logros con texto auto-ajustado (FitText) y stats del gremio.
// ============================================================

import { useState } from "react"
import { signOut } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  DollarSign,
  FileBarChart,
  FlaskConical,
  Footprints,
  Loader2,
  LogOut,
  Map,
  Megaphone,
  MessageCircle,
  Package,
  Pencil,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useMe } from "@/hooks/use-me"
import { useAppStore } from "@/lib/store"
import { ACHIEVEMENTS } from "@/lib/levels"
import { completionChecklist, isVerifiedUser, profileCompletion } from "@/lib/profile"
import { timeAgo } from "@/lib/time"
import type {
  ApiErrorShape,
  LevelInfo,
  MeAchievement,
  MeUser,
  PublicProfileUser,
  PublicResults,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"
import { FitText } from "@/components/alqemia/fx/fit-text"
import { AlqEmoji, AlqText } from "@/components/alqemia/alq-emoji"
import { AliadosSection } from "@/components/alqemia/profile/aliados-section"
import { LevelBadge } from "@/components/alqemia/level-badge"
import { LevelProgress } from "@/components/alqemia/level-progress"
import { UserAvatar } from "@/components/alqemia/avatar"
import { EditProfileDialog } from "./edit-profile-dialog"
import { Leaderboard } from "./leaderboard"

/** Icono lucide asociado a cada logro (ACHIEVEMENTS[code].icon) */
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Map,
  FlaskConical,
  Megaphone,
  FileBarChart,
  MessageCircle,
  Footprints,
  BookOpen,
  Trophy,
  Award,
}

const MONTH_YEAR = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" })
const COMPACT_NUMBER = new Intl.NumberFormat("es", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** Facturación compacta: 12300 → "$12,3 K" */
function formatUsdCompact(value: number): string {
  return `$${COMPACT_NUMBER.format(value)}`
}

/** Modelo de identidad normalizado (propio + público) */
type ProfileIdentity = {
  id: string
  name: string
  image: string | null
  avatarColor: string | null
  headline: string | null
  bio: string | null
  goal: string | null
  coverImage: string | null
  verified: boolean
  xp: number
  level: LevelInfo
  createdAt: string
  achievements: MeAchievement[]
}

function identityFromMe(u: MeUser): ProfileIdentity {
  return {
    id: u.id,
    name: u.name,
    image: u.image,
    avatarColor: u.avatarColor,
    headline: u.headline,
    bio: u.bio,
    goal: u.goal,
    coverImage: u.coverImage,
    verified: isVerifiedUser(u),
    xp: u.xp,
    level: u.level,
    createdAt: u.createdAt,
    achievements: u.achievements,
  }
}

function identityFromPublic(u: PublicProfileUser): ProfileIdentity {
  return {
    id: u.id,
    name: u.name,
    image: u.image,
    avatarColor: u.avatarColor,
    headline: u.headline,
    bio: u.bio,
    goal: null,
    coverImage: u.coverImage,
    verified: isVerifiedUser(u),
    xp: u.xp,
    level: u.level,
    createdAt: u.createdAt,
    achievements: u.achievements,
  }
}

async function fetchPublicUser(id: string): Promise<{ user: PublicProfileUser }> {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as ApiErrorShape
    throw new Error(json.error ?? "No se pudo cargar el perfil")
  }
  return res.json()
}

/** Contrato global del gremio: pedir abrir el perfil público de un miembro */
export function openPublicProfile(id: string) {
  window.dispatchEvent(new CustomEvent("alqemia:open-profile", { detail: id }))
}

/** Chulito azul estilo Instagram/Twitter (única excepción al no-azul) */
function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("h-4 w-4 shrink-0 fill-sky-400 text-zinc-950", className)}
      aria-label="Cuenta verificada"
    />
  )
}

/** Portada 16:9: foto del miembro o marca de agua del gremio */
function ProfileCover({ coverImage }: { coverImage: string | null }) {
  if (coverImage) {
    return (
      <div className="relative h-36 w-full sm:h-44">
        <img
          src={coverImage}
          alt="Portada del perfil"
          className="h-full w-full rounded-2xl object-cover"
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-gold/30" aria-hidden />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-2xl bg-gradient-to-t from-zinc-950/70 to-transparent"
          aria-hidden
        />
      </div>
    )
  }
  return (
    <div
      className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 sm:h-44"
      aria-hidden
    >
      <AlqEmoji token="sol" className="absolute left-6 top-5 h-6 w-6 text-gold/20" />
      <AlqEmoji token="luna" className="absolute right-8 top-8 h-5 w-5 text-gold/15" />
      <AlqEmoji token="alembic" className="absolute bottom-6 left-1/4 h-6 w-6 text-gold/15" />
      <AlqEmoji token="azoth" className="absolute bottom-5 right-1/4 h-5 w-5 text-gold/20" />
      <AlqemiaLetters text="ALQEMIA" tone="mono" className="text-4xl text-gold/10" />
    </div>
  )
}

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-gold-deep" aria-hidden />
      <p className="mt-1.5 truncate font-semibold tabular-nums text-zinc-100">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p> : null}
    </div>
  )
}

/** Tarjeta de resultados reportados (solo si hay evidencia) */
function ResultsCard({ results }: { results: PublicResults }) {
  if (results.reports <= 0) return null
  return (
    <Card className="mt-4 min-w-0 gap-0 rounded-2xl p-5">
      <h2 className="min-w-0 text-base sm:text-lg">
        <AlqemiaLetters text="Resultados reportados" strokeWidth={9} />
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Evidencia compartida por el miembro al publicar en el muro
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCell
          icon={DollarSign}
          label="Facturación"
          value={formatUsdCompact(results.totalRevenue)}
        />
        <StatCell
          icon={Package}
          label="Pedidos"
          value={String(results.totalOrders)}
        />
        <StatCell
          icon={TrendingUp}
          label="ROAS promedio"
          value={results.avgRoas != null ? `x${results.avgRoas.toFixed(1)}` : "—"}
        />
        <StatCell
          icon={ClipboardCheck}
          label="Evidencias"
          value={String(results.reports)}
          hint={results.lastReportAt ? `última ${timeAgo(results.lastReportAt)}` : undefined}
        />
      </div>
    </Card>
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card className="gap-0 overflow-hidden rounded-2xl p-0">
        <Skeleton className="h-36 w-full rounded-none sm:h-44" />
        <div className="space-y-4 p-5 sm:p-6">
          <Skeleton className="-mt-16 h-20 w-20 rounded-full" />
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

export function ProfileView({
  userId,
  onBack,
}: {
  userId?: string
  onBack?: () => void
}) {
  const meQuery = useMe()
  const meUser = meQuery.data?.user
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const isOwnMode = !userId
  // En modo propio también consultamos la API pública para los
  // contadores (posts/comentarios) y los resultados reportados.
  const targetId = userId ?? meUser?.id ?? null

  const publicQuery = useQuery({
    queryKey: ["public-user", targetId],
    queryFn: () => fetchPublicUser(targetId as string),
    enabled: targetId !== null,
    staleTime: 15_000,
    retry: false,
  })
  const publicUser = publicQuery.data?.user ?? null

  // Ver el propio id en modo "público" (p. ej. desde el ranking) = perfil propio
  const isOwn = isOwnMode || publicUser?.isOwn === true

  // ---- Carga / error ----
  if (isOwnMode && (meQuery.isLoading || !meUser)) {
    return <ProfileSkeleton />
  }
  if (!isOwnMode && !publicUser) {
    if (publicQuery.isLoading) {
      return <ProfileSkeleton />
    }
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card className="flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <p className="text-sm text-zinc-300">
            {(publicQuery.error as Error | null)?.message ?? "No se pudo cargar el perfil"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void publicQuery.refetch()}
          >
            {publicQuery.isFetching ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RotateCcw aria-hidden />
            )}
            Reintentar
          </Button>
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft aria-hidden />
              Volver
            </Button>
          ) : null}
        </Card>
      </div>
    )
  }

  const identity: ProfileIdentity | null = isOwn
    ? meUser
      ? identityFromMe(meUser)
      : publicUser
        ? identityFromPublic(publicUser)
        : null
    : publicUser
      ? identityFromPublic(publicUser)
      : null
  if (!identity) return <ProfileSkeleton />

  const postCount = publicUser?.postCount ?? null
  const commentCount = publicUser?.commentCount ?? null
  const results = publicUser?.results ?? null

  function handleSignOut() {
    useAppStore.getState().reset()
    void queryClient.clear()
    void signOut({ callbackUrl: "/" })
  }

  function handleBack() {
    if (onBack) onBack()
    else window.history.back()
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl p-0">
        {/* Portada */}
        <ProfileCover coverImage={identity.coverImage} />

        <div className="p-5 pt-0 sm:p-6 sm:pt-0">
          <UserAvatar
            user={identity}
            size="2xl"
            className="-mt-10 h-20 w-20 ring-2 ring-gold ring-offset-4 ring-offset-zinc-950"
          />

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl leading-normal">
              <AlqemiaLetters text={identity.name} strokeWidth={8} />
            </h1>
            {identity.verified ? <VerifiedBadge className="h-5 w-5" /> : null}
            <LevelBadge level={identity.level} />
          </div>
          {identity.headline ? (
            <p className="mt-1.5 text-sm text-zinc-500">{identity.headline}</p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-400">
            Miembro desde {MONTH_YEAR.format(new Date(identity.createdAt))}
          </p>

          <LevelProgress level={identity.level} className="mt-4" />

          {/* Stats del gremio */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatCell
              icon={Megaphone}
              label="Publicaciones"
              value={postCount != null ? String(postCount) : "—"}
            />
            <StatCell
              icon={MessageCircle}
              label="Comentarios"
              value={commentCount != null ? String(commentCount) : "—"}
            />
            <StatCell
              icon={Zap}
              label="XP total"
              value={String(identity.xp)}
            />
          </div>

          {/* Resultados reportados (solo con evidencia) */}
          {results ? <ResultsCard results={results} /> : null}

          {/* Bio con emojis alquímicos */}
          {identity.bio ? (
            <div className="mt-5 min-w-0">
              <Label className="text-xs text-zinc-400">Sobre mí</Label>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                <AlqText text={identity.bio} />
              </p>
            </div>
          ) : isOwn ? (
            <div className="mt-5 flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-dashed border-zinc-800 p-3.5">
              <p className="text-xs text-zinc-500">Cuéntale al gremio quién eres</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gold hover:text-gold-bright"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden />
                Escribir bio
              </Button>
            </div>
          ) : null}

          {isOwn && identity.goal ? (
            <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold-bright/60 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-bright">
              <Target className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{identity.goal}</span>
            </span>
          ) : null}

          {/* Completitud (solo perfil propio) */}
          {isOwn
            ? (() => {
                if (!meUser) return null
                const completion = profileCompletion(meUser)
                const missing = completionChecklist(meUser).filter((c) => !c.done)
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
              })()
            : null}

          {/* Acciones */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {isOwn ? (
              <>
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
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft aria-hidden />
                Volver
              </Button>
            )}
          </div>

          {/* Logros */}
          <div className="mt-6">
            <h2 className="text-lg">
              <AlqemiaLetters text="Logros" strokeWidth={9} />
            </h2>
            <p className="text-xs text-zinc-500">
              {isOwn ? "Tu colección de transmutaciones" : "Colección de transmutaciones"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(ACHIEVEMENTS).map(([code, achievement]) => {
                const unlocked = identity.achievements.find((a) => a.code === code)
                const Icon = ICONS[achievement.icon] ?? Sparkles
                return (
                  <Card
                    key={code}
                    className={cn(
                      // Móvil: icono ARRIBA y texto con todo el ancho de la
                      // tarjeta (así los nombres largos no tienen que encogerse
                      // hasta lo ilegible). sm+: icono a la izquierda.
                      "min-w-0 flex-row items-center gap-3 rounded-2xl p-3.5 max-sm:flex-col max-sm:items-start max-sm:gap-2.5",
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
                    <div className="min-w-0 w-full flex-1">
                      {/* FitText: el nombre NUNCA se desborda en móvil */}
                      <FitText
                        as="p"
                        lines={2}
                        className={cn(
                          "text-sm font-medium leading-tight",
                          unlocked ? "text-zinc-100" : "text-zinc-400"
                        )}
                      >
                        {achievement.label}
                      </FitText>
                      <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
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

      {/* Aliados + Ranking solo en el perfil propio */}
      {isOwn ? (
        <>
          <div className="mt-6">
            <AliadosSection />
          </div>
          <div className="mt-6">
            <Leaderboard onOpenProfile={openPublicProfile} />
          </div>
        </>
      ) : null}

      <EditProfileDialog open={editing} onOpenChange={setEditing} />
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  ArrowLeft,
  Ban,
  BookOpen,
  Heart,
  Lock,
  MessageCircle,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { AdminStats, AdminUserRow, FeedPost, UserStatus } from "@/lib/types"
import { useAppStore } from "@/lib/store"
import { formatDayLabel, timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/alqemia/empty-state"
import { UserAvatar } from "@/components/alqemia/avatar"

// ============================================================
// Fetch autenticado con clave de admin (localStorage)
// ============================================================

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const key = localStorage.getItem("alqemia-admin-key") ?? ""
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": key,
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) {
    useAppStore.getState().setAdminUnlocked(false)
    throw new Error("Sesión de admin cerrada")
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? "Error inesperado")
  }
  return res.json() as Promise<T>
}

type AdminPost = FeedPost & { authorEmail: string }

function isLockedError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("admin cerrada")
}

// ============================================================
// Estados de query
// ============================================================

function LockedNotice() {
  const setAdminGateOpen = useAppStore((s) => s.setAdminGateOpen)
  return (
    <Card className="gap-0 rounded-2xl p-0">
      <EmptyState
        icon={Lock}
        title="Sesión de admin finalizada"
        description="Vuelve a desbloquear el panel con tu clave."
        action={
          <Button variant="outline" size="sm" onClick={() => setAdminGateOpen(true)}>
            Desbloquear panel
          </Button>
        }
      />
    </Card>
  )
}

function QueryErrorView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Card className="gap-0 rounded-2xl p-0">
      <EmptyState
        icon={TriangleAlert}
        title="No se pudo cargar"
        description={error.message}
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        }
      />
    </Card>
  )
}

// ============================================================
// Tab Resumen
// ============================================================

const STAT_CARDS: { icon: LucideIcon; label: string; value: (s: AdminStats) => number }[] = [
  { icon: Users, label: "Miembros totales", value: (s) => s.totalUsers },
  { icon: Activity, label: "Activos (7 días)", value: (s) => s.activeUsers7d },
  { icon: Ban, label: "Suspendidos", value: (s) => s.blockedUsers },
  { icon: MessageSquare, label: "Publicaciones", value: (s) => s.totalPosts },
  { icon: MessageCircle, label: "Comentarios", value: (s) => s.totalComments },
  { icon: Heart, label: "Me gusta", value: (s) => s.totalLikes },
  { icon: BookOpen, label: "Lecciones (7d)", value: (s) => s.lessonsCompleted7d },
  { icon: Zap, label: "XP acumulado", value: (s) => s.totalXp },
]

function ResumenTab() {
  const query = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminFetch<AdminStats>("/api/admin/stats"),
  })

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="gap-0 rounded-2xl p-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </Card>
          ))}
        </div>
        <Card className="gap-0 rounded-2xl p-5">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-4 h-[220px] w-full" />
        </Card>
        <Card className="gap-0 rounded-2xl p-5">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (query.error) {
    if (isLockedError(query.error)) return <LockedNotice />
    return <QueryErrorView error={query.error} onRetry={() => void query.refetch()} />
  }

  const stats = query.data
  if (!stats) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="gap-0 rounded-2xl p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950">
              <Icon className="h-5 w-5 text-gold" aria-hidden />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-zinc-100">
              {value(stats)}
            </p>
            <p className="text-xs text-zinc-500">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="gap-0 rounded-2xl p-5">
        <h3 className="font-semibold text-zinc-100">Nuevos miembros (últimos 14 días)</h3>
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.signupsByDay} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9a441" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#d9a441" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDayLabel(String(v))}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                labelFormatter={(label) => formatDayLabel(String(label))}
                formatter={(value) => [`${value}`, "Miembros"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #27272a",
                  background: "#131312",
                  fontSize: 12,
                  color: "#f4f1e8",
                }}
                labelStyle={{ color: "#a39f92" }}
                itemStyle={{ color: "#f7d97a" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#d9a441"
                strokeWidth={2}
                fill="url(#goldFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="gap-0 rounded-2xl p-5">
        <h3 className="font-semibold text-zinc-100">Top creadores</h3>
        {stats.topCreators.length === 0 ? (
          <p className="mt-4 text-xs text-zinc-400">Todavía no hay actividad de creadores.</p>
        ) : (
          <div className="mt-2 divide-y divide-zinc-800">
            {stats.topCreators.map((creator) => (
              <div key={creator.id} className="flex items-center gap-3 py-2">
                <UserAvatar user={creator} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{creator.name}</p>
                  <p className="text-xs text-zinc-500">
                    {creator.posts} publicaciones · {creator.comments} comentarios
                  </p>
                </div>
                <Zap className="h-3.5 w-3.5 shrink-0 text-gold-deep" aria-hidden />
                <span className="shrink-0 text-sm font-semibold text-zinc-100">{creator.xp}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================================
// Tab Usuarios
// ============================================================

function StatusBadge({ status }: { status: UserStatus }) {
  const active = status === "ACTIVE"
  return (
    <Badge
      variant="outline"
      className={cn(
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10"
          : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/10"
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-red-500")}
        aria-hidden
      />
      {active ? "Activo" : "Suspendido"}
    </Badge>
  )
}

function StatusAction({
  user,
  onConfirm,
  fullWidth = false,
}: {
  user: AdminUserRow
  onConfirm: (user: AdminUserRow) => void
  fullWidth?: boolean
}) {
  const isBlocked = user.status === "BLOCKED"
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            fullWidth && "w-full justify-center",
            isBlocked
              ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              : "border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          )}
        >
          {isBlocked ? <RotateCcw aria-hidden /> : <Ban aria-hidden />}
          {isBlocked ? "Reactivar" : "Bloquear"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBlocked ? `¿Reactivar a ${user.name}?` : `¿Suspender a ${user.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBlocked
              ? "Podrá volver a ingresar al hub e interactuar con la comunidad."
              : "No podrá ingresar al hub ni interactuar con la comunidad."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={
              isBlocked
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }
            onClick={() => onConfirm(user)}
          >
            {isBlocked ? "Reactivar" : "Suspender"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Eliminar miembro (con confirmación). Oculto para cuentas ADMIN. */
function DeleteAction({
  user,
  onConfirm,
}: {
  user: AdminUserRow
  onConfirm: (user: AdminUserRow) => void
}) {
  if (user.role === "ADMIN") return null
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Eliminar a ${user.name}`}
          title="Eliminar miembro"
          className="h-8 w-8 border-zinc-700 text-zinc-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará su cuenta y todo su contenido: publicaciones, comentarios,
            me gusta y progreso. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => onConfirm(user)}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="truncate text-xs font-medium text-zinc-200">{value}</p>
    </div>
  )
}

function UsersTab() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const query = useQuery({
    queryKey: ["admin-users", debouncedQ],
    queryFn: () =>
      adminFetch<{ users: AdminUserRow[] }>(`/api/admin/users?q=${encodeURIComponent(debouncedQ)}`),
  })
  const users = query.data?.users ?? []

  const statusMutation = useMutation({
    mutationFn: (vars: { userId: string; status: UserStatus; name: string }) =>
      adminFetch<{ ok: boolean }>("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: vars.userId, status: vars.status }),
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] })
      toast.success(
        vars.status === "BLOCKED" ? `${vars.name} suspendido` : `${vars.name} reactivado`
      )
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (vars: { userId: string; name: string }) =>
      adminFetch<{ ok: boolean }>("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ userId: vars.userId }),
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] })
      toast.success(`${vars.name} eliminado del hub`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function changeStatus(user: AdminUserRow) {
    statusMutation.mutate({
      userId: user.id,
      status: user.status === "ACTIVE" ? "BLOCKED" : "ACTIVE",
      name: user.name,
    })
  }

  if (query.error && isLockedError(query.error)) return <LockedNotice />

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="pl-9"
          />
        </div>
        <p className="shrink-0 text-xs text-zinc-400">{users.length} miembros</p>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.error ? (
        <QueryErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : users.length === 0 ? (
        <Card className="gap-0 rounded-2xl p-0">
          <EmptyState
            icon={Users}
            title="Sin resultados"
            description="No encontramos miembros que coincidan con tu búsqueda."
          />
        </Card>
      ) : (
        <>
          {/* Tabla escritorio */}
          <Card className="hidden gap-0 overflow-hidden rounded-2xl p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Miembro</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>XP</TableHead>
                  <TableHead>Posts</TableHead>
                  <TableHead>Comentarios</TableHead>
                  <TableHead>Lecciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Últ. actividad</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <UserAvatar user={u} size="sm" />
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate text-sm font-medium text-zinc-100">
                            {u.name}
                          </p>
                          <p className="max-w-[220px] truncate text-xs text-zinc-400">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-zinc-400">
                      Nv {u.level.level} · {u.level.name}
                    </TableCell>
                    <TableCell className="font-semibold text-zinc-100">{u.xp}</TableCell>
                    <TableCell className="text-sm text-zinc-400">{u.postCount}</TableCell>
                    <TableCell className="text-sm text-zinc-400">{u.commentCount}</TableCell>
                    <TableCell className="text-sm text-zinc-400">{u.lessonsCompleted}</TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-zinc-500">
                      {timeAgo(u.lastActiveAt)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <StatusAction user={u} onConfirm={changeStatus} />
                        <DeleteAction
                          user={u}
                          onConfirm={(usr) => deleteMutation.mutate({ userId: usr.id, name: usr.name })}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Tarjetas móvil */}
          <div className="space-y-3 md:hidden">
            {users.map((u) => (
              <Card key={u.id} className="gap-0 rounded-2xl p-4">
                <div className="flex items-center gap-2.5">
                  <UserAvatar user={u} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">{u.name}</p>
                    <p className="truncate text-xs text-zinc-400">{u.email}</p>
                  </div>
                  <StatusBadge status={u.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniStat label="Nivel" value={`Nv ${u.level.level}`} />
                  <MiniStat label="XP" value={String(u.xp)} />
                  <MiniStat label="Posts" value={String(u.postCount)} />
                  <MiniStat label="Comentarios" value={String(u.commentCount)} />
                  <MiniStat label="Lecciones" value={String(u.lessonsCompleted)} />
                  <MiniStat label="Últ. actividad" value={timeAgo(u.lastActiveAt)} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <StatusAction user={u} onConfirm={changeStatus} fullWidth />
                  <DeleteAction
                    user={u}
                    onConfirm={(usr) => deleteMutation.mutate({ userId: usr.id, name: usr.name })}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// Tab Contenido
// ============================================================

function ContentTab() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["admin-posts"],
    queryFn: () => adminFetch<{ posts: AdminPost[] }>("/api/admin/posts"),
  })
  const posts = query.data?.posts ?? []

  const deleteMutation = useMutation({
    mutationFn: (postId: string) =>
      adminFetch<{ ok: boolean }>(`/api/posts/${postId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-posts"] })
      void queryClient.invalidateQueries({ queryKey: ["feed"] })
      toast.success("Publicación eliminada")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (query.error && isLockedError(query.error)) return <LockedNotice />

  return (
    <div>
      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.error ? (
        <QueryErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : posts.length === 0 ? (
        <Card className="gap-0 rounded-2xl p-0">
          <EmptyState
            icon={MessageSquare}
            title="Sin publicaciones"
            description="Cuando los miembros publiquen, aparecerán aquí."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="gap-0 rounded-2xl p-4">
              <div className="flex items-center gap-2.5">
                <UserAvatar user={post.user} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{post.user.name}</p>
                  <p className="truncate text-xs text-zinc-400">{post.authorEmail}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs text-zinc-400">
                  {timeAgo(post.createdAt)}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-zinc-300">{post.content}</p>
              {post.image ? (
                <img
                  src={post.image}
                  alt="Miniatura de la publicación"
                  className="mt-2 h-16 w-24 rounded-lg object-cover"
                />
              ) : null}
              <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" aria-hidden />
                  {post.likeCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  {post.commentCount}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      aria-label="Eliminar publicación"
                    >
                      <Trash2 aria-hidden />
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar esta publicación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se borrarán también sus comentarios y me gusta.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={() => deleteMutation.mutate(post.id)}
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Vista principal
// ============================================================

export function AdminView() {
  const setView = useAppStore((s) => s.setView)

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950">
          <ShieldCheck className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold leading-tight text-zinc-100 sm:text-2xl">
            Panel de Administración
          </h1>
          <p className="text-sm text-zinc-500">Control y métricas del Hub ALQEMIA</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => setView("feed")}
        >
          <ArrowLeft aria-hidden />
          Volver al Hub
        </Button>
      </div>

      <Tabs defaultValue="resumen" className="mt-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="mt-4">
          <ResumenTab />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="contenido" className="mt-4">
          <ContentTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

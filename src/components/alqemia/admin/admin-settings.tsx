"use client"

// ============================================================
// ADMIN — Ajustes del hub (solo titular)
//  · Vídeo del Muro: URL de YouTube/MP4 que ve todo el gremio
//    entre el título del Muro y la caja de publicar.
//  · La Gran Purga: zona de peligro para vaciar miembros y muro.
// ============================================================

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  Lock,
  PlayCircle,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { useAppStore } from "@/lib/store"
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
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/alqemia/empty-state"
import { adminFetch, isLockedError } from "@/components/alqemia/admin/admin-fetch"

type AdminSetting = { key: string; value: string; updatedAt: string }

type PurgeSummary = {
  membersBefore: number
  membersRemoved: number
  postsBefore: number
  postsRemoved: number
}

// ============================================================
// Estados de query (mismo patrón que admin-view)
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
// Vista previa del vídeo (mismo criterio que el Muro)
// ============================================================

/** Extrae la URL de embed de YouTube (watch / youtu.be / embed / shorts) o null. */
function youtubeEmbed(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/i,
    /(?:youtu\.be\/)([\w-]{6,})/i,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return `https://www.youtube.com/embed/${m[1]}`
  }
  return null
}

function VideoPreview({ url }: { url: string }) {
  const embed = youtubeEmbed(url)
  if (embed) {
    return (
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={embed}
          title="Vista previa del vídeo del muro"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }
  if (/\.(mp4|webm)(\?.*)?$/i.test(url)) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        playsInline
        className="w-full bg-black"
        style={{ aspectRatio: "16 / 9" }}
      />
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-4 py-4 text-sm font-medium text-gold-bright transition-colors hover:text-gold"
    >
      <PlayCircle className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate">{url}</span>
    </a>
  )
}

// ============================================================
// Sección 1 — Vídeo del Muro
// ============================================================

function MuroVideoSection({ value }: { value: string }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState(value)

  useEffect(() => {
    setUrl(value)
  }, [value])

  const saveMutation = useMutation({
    mutationFn: (v: string) =>
      adminFetch<{ ok: boolean }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "muro_video", value: v }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["muro-video"] })
      toast.success("Vídeo del muro actualizado")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const removeMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean }>("/api/admin/settings?key=muro_video", { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["muro-video"] })
      toast.success("Vídeo del muro quitado")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function save() {
    const v = url.trim()
    if (!/^https?:\/\//i.test(v)) {
      toast.error("La URL del vídeo debe empezar por http:// o https://")
      return
    }
    saveMutation.mutate(v)
  }

  const trimmed = url.trim()

  return (
    <Card className="gap-0 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-gold" aria-hidden />
        <h3 className="font-display text-base font-semibold text-zinc-100">Vídeo del Muro</h3>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
        Sube un vídeo que verá todo el gremio entre el título del Muro y la caja de publicar.
        Acepta enlaces de YouTube o MP4 directo.
      </p>

      <div className="mt-4">
        <Label htmlFor="muro-video-url">URL del vídeo</Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="muro-video-url"
            placeholder="https://youtube.com/watch?v=… o https://…/video.mp4"
            className="border-zinc-800 bg-zinc-950/70"
            maxLength={2000}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              className="btn-gold font-semibold"
              disabled={saveMutation.isPending}
              onClick={save}
            >
              {saveMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              disabled={removeMutation.isPending || !value}
              onClick={() => removeMutation.mutate()}
            >
              {removeMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Trash2 aria-hidden />
              )}
              Quitar vídeo
            </Button>
          </div>
        </div>
      </div>

      {trimmed ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Vista previa
          </p>
          <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <VideoPreview url={trimmed} />
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
          Todavía no hay vídeo configurado para el Muro.
        </p>
      )}
    </Card>
  )
}

// ============================================================
// Sección 2 — La Gran Purga (zona de peligro)
// ============================================================

function PurgeSection() {
  const queryClient = useQueryClient()

  const purgeMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean; summary: PurgeSummary }>("/api/admin/purge", { method: "POST" }),
    onSuccess: (data) => {
      for (const key of ["admin-stats", "admin-users", "admin-courses", "feed", "leaderboard"]) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      toast.success(
        `Eliminados ${data.summary.membersRemoved} miembros y ${data.summary.postsRemoved} publicaciones`
      )
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Card className="gap-0 rounded-2xl border-red-500/40 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-red-500" aria-hidden />
        <h3 className="font-display text-base font-semibold text-red-400">La Gran Purga</h3>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
        Elimina TODOS los miembros de demostración y vacía el muro por completo. Solo quedas tú
        (Titular, #1 Gran Maestre con XP INFINITUM). Esta acción no se puede deshecer.
      </p>
      <div className="mt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 font-semibold hover:bg-red-700"
              disabled={purgeMutation.isPending}
            >
              {purgeMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Trash2 aria-hidden />
              )}
              Ejecutar la Gran Purga
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Ejecutar la Gran Purga?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán TODOS los miembros excepto tú y se vaciará el muro por completo,
                incluidas tus publicaciones.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-400">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                Acción irreversible
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-300/90">
                No habrá vuelta atrás: los miembros eliminados tendrán que registrarse de nuevo y
                el muro quedará vacío.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={purgeMutation.isPending}
                onClick={() => purgeMutation.mutate()}
              >
                {purgeMutation.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                Sí, ejecutar la purga
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  )
}

// ============================================================
// Ajustes — vista principal
// ============================================================

export function AdminSettings() {
  const query = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminFetch<{ settings: AdminSetting[] }>("/api/admin/settings"),
  })

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Card className="gap-0 rounded-2xl p-4 sm:p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
          <Skeleton className="mt-4 h-9 w-full" />
          <Skeleton className="mt-4 aspect-video max-h-44 w-full rounded-xl" />
        </Card>
        <Card className="gap-0 rounded-2xl border-red-500/40 p-4 sm:p-5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-3 h-4 w-full max-w-lg" />
          <Skeleton className="mt-4 h-9 w-48" />
        </Card>
      </div>
    )
  }

  if (query.error) {
    if (isLockedError(query.error)) return <LockedNotice />
    return <QueryErrorView error={query.error} onRetry={() => void query.refetch()} />
  }

  const muroVideo = query.data?.settings.find((s) => s.key === "muro_video")?.value ?? ""

  return (
    <div className="space-y-4">
      <MuroVideoSection value={muroVideo} />
      <PurgeSection />
    </div>
  )
}

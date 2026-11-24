"use client"

// ============================================================
// ADMIN — Ajustes del hub (solo titular)
//  · Vídeo del Muro: URL de YouTube/MP4 que ve todo el gremio
//    entre el título del Muro y la caja de publicar.
//  · La Gran Purga: zona de peligro para vaciar miembros y muro.
// ============================================================

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
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/alqemia/empty-state"
import { adminFetch, isLockedError } from "@/components/alqemia/admin/admin-fetch"
import {
  PosterUploadField,
  VideoUploadField,
  mediaKeyFromUrl,
} from "@/components/alqemia/admin/video-upload"

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
// Sección 1 — Vídeo del Muro (subida de archivo real)
// ============================================================

function MuroVideoSection({ value, poster }: { value: string; poster: string }) {
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: (v: string) =>
      adminFetch<{ ok: boolean }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "muro_video", value: v }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["muro-video"] })
      toast.success("Vídeo del muro actualizado: ya lo ve todo el gremio")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const savePosterMutation = useMutation({
    mutationFn: (v: string) =>
      adminFetch<{ ok: boolean }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "muro_video_poster", value: v }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["muro-video"] })
      toast.success("Portada del vídeo actualizada")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const removePosterMutation = useMutation({
    mutationFn: async () => {
      // Borrar el archivo de la portada anterior (si era interno)
      const oldKey = mediaKeyFromUrl(poster)
      if (oldKey) {
        try {
          await adminFetch<{ ok: boolean }>(`/api/admin/media?key=${encodeURIComponent(oldKey)}`, {
            method: "DELETE",
          })
        } catch {
          /* el ajuste se quita igualmente */
        }
      }
      return adminFetch<{ ok: boolean }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "muro_video_poster", value: "" }),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["muro-video"] })
      toast.success("Portada quitada")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      // 1) Borrar el archivo subido (si el valor actual es interno)
      const key = mediaKeyFromUrl(value)
      if (key) {
        try {
          await adminFetch<{ ok: boolean }>(`/api/admin/media?key=${encodeURIComponent(key)}`, {
            method: "DELETE",
          })
        } catch {
          // El ajuste se quita igualmente aunque falle el borrado
        }
      }
      // 2) Quitar el ajuste del muro
      return adminFetch<{ ok: boolean }>("/api/admin/settings?key=muro_video", { method: "DELETE" })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      void queryClient.invalidateQueries({ queryKey: ["muro-video"] })
      toast.success("Vídeo del muro quitado")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saving =
    saveMutation.isPending || removeMutation.isPending || savePosterMutation.isPending

  return (
    <Card className="gap-0 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-gold" aria-hidden />
        <h3 className="font-display text-base font-semibold text-zinc-100">Vídeo del Muro</h3>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
        Sube un vídeo desde tu teléfono o PC y lo verá todo el gremio entre el título del Muro y
        la caja de publicar. Es subir el archivo directamente — sin enlaces.
      </p>

      <div className="mt-4">
        <VideoUploadField
          scope="muro"
          value={value}
          poster={poster}
          onUploaded={(url) => saveMutation.mutate(url)}
          onRemoved={() => removeMutation.mutate()}
          disabled={saving}
        />
      </div>

      {value ? (
        <div className="mt-4">
          <PosterUploadField
            value={poster}
            onUploaded={(p) => savePosterMutation.mutate(p)}
            onRemoved={() => removePosterMutation.mutate()}
            disabled={saving || savePosterMutation.isPending || removePosterMutation.isPending}
            label="Portada del vídeo del muro (opcional)"
            scope="muro"
          />
        </div>
      ) : null}

      {saveMutation.isPending && (
        <p className="mt-3 flex items-center gap-2 text-xs text-gold-bright">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Guardando el vídeo del muro…
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
  const muroPoster = query.data?.settings.find((s) => s.key === "muro_video_poster")?.value ?? ""

  return (
    <div className="space-y-4">
      <MuroVideoSection value={muroVideo} poster={muroPoster} />
      <PurgeSection />
    </div>
  )
}

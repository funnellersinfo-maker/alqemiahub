"use client"

// ============================================================
// ADMIN — Gestión del canal EN VIVO
// Crear transmisiones (imagen 16:9, fecha, reseña, link),
// activar el punto rojo EN VIVO, finalizar y subir grabación.
// ============================================================

import { useRef, useState, type ChangeEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarClock,
  ImagePlus,
  Link2,
  Loader2,
  MonitorPlay,
  Plus,
  Radio,
  Square,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { LiveDot } from "@/components/alqemia/live/live-view"
import { compressImage } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import type { LiveSessionDTO } from "@/lib/types"

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const key = localStorage.getItem("alqemia-admin-key") ?? ""
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "x-admin-key": key, ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? "Error inesperado")
  }
  return res.json() as Promise<T>
}

function localDateTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [scheduledAt, setScheduledAt] = useState(localDateTimeValue(new Date(Date.now() + 3600_000)))
  const [streamUrl, setStreamUrl] = useState("")
  const [cover, setCover] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setProcessing(true)
    try {
      setCover(await compressImage(file, { maxWidth: 1280, aspect: 16 / 9, quality: 0.8 }))
    } catch {
      toast.error("No se pudo procesar la imagen")
    } finally {
      setProcessing(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      adminFetch("/api/admin/live", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          scheduledAt: new Date(scheduledAt).toISOString(),
          streamUrl: streamUrl.trim() || undefined,
          coverImage: cover ?? undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Transmisión programada: visible en la sección En Vivo")
      setTitle("")
      setDescription("")
      setStreamUrl("")
      setCover(null)
      void queryClient.invalidateQueries({ queryKey: ["admin-lives"] })
      void queryClient.invalidateQueries({ queryKey: ["live"] })
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit() {
    if (title.trim().length < 3) {
      toast.error("Escribe un título para la transmisión")
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="live-title">Título de la transmisión</Label>
        <Input
          id="live-title"
          placeholder="Ej. Masterclass: Embudos de venta que convierten"
          className="mt-2 border-zinc-800 bg-zinc-950/70"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="live-date">Fecha y hora</Label>
          <Input
            id="live-date"
            type="datetime-local"
            className="mt-2 border-zinc-800 bg-zinc-950/70"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="live-url">Link de transmisión (YouTube/Meet/Zoom)</Label>
          <Input
            id="live-url"
            placeholder="https://youtube.com/live/… o meet.google.com/…"
            className="mt-2 border-zinc-800 bg-zinc-950/70"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="live-desc">Reseña: ¿de qué tratará el live?</Label>
        <Textarea
          id="live-desc"
          rows={3}
          maxLength={2000}
          placeholder="Cuéntale al gremio qué va a aprender y por qué no debería perdérselo…"
          className="mt-2 resize-none border-zinc-800 bg-zinc-950/70"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Label>Imagen de anuncio 16:9 (se muestra en "Próximamente")</Label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "mt-2 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 transition-colors hover:border-gold/50 hover:text-zinc-200",
            cover ? "aspect-video" : "p-4"
          )}
        >
          {processing ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : cover ? (
            <img src={cover} alt="Vista previa de la imagen del live" className="h-full w-full object-cover" />
          ) : (
            <span className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5" aria-hidden /> Adjuntar imagen 16:9
            </span>
          )}
        </button>
      </div>
      <Button type="button" className="btn-gold font-semibold" disabled={createMutation.isPending} onClick={submit}>
        {createMutation.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        Programar transmisión
      </Button>
    </div>
  )
}

function LiveRow({ live }: { live: LiveSessionDTO }) {
  const queryClient = useQueryClient()
  const [replayUrl, setReplayUrl] = useState(live.replayUrl ?? "")
  const [savingReplay, setSavingReplay] = useState(false)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-lives"] })
    void queryClient.invalidateQueries({ queryKey: ["live"] })
    void queryClient.invalidateQueries({ queryKey: ["live-status"] })
  }

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      adminFetch("/api/admin/live", { method: "PATCH", body: JSON.stringify({ id: live.id, ...payload }) }),
    onSuccess: (_d, payload) => {
      if (payload.status === "LIVE") toast.success("¡EN VIVO! El punto rojo ya titila para toda la comunidad")
      else if (payload.status === "ENDED") toast.success("Transmisión finalizada")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminFetch(`/api/admin/live?id=${live.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Transmisión eliminada")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function saveReplay() {
    const url = replayUrl.trim()
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("El enlace de la grabación debe empezar por http(s)://")
      return
    }
    setSavingReplay(true)
    try {
      await adminFetch("/api/admin/live", {
        method: "PATCH",
        body: JSON.stringify({ id: live.id, replayUrl: url || null }),
      })
      toast.success(url ? "Grabación guardada: visible en la sección En Vivo" : "Grabación quitada")
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setSavingReplay(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 sm:flex-row">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:w-44">
        {live.coverImage ? (
          <img src={live.coverImage} alt={`Portada de ${live.title}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MonitorPlay className="h-6 w-6 text-zinc-700" aria-hidden />
          </div>
        )}
        {live.status === "LIVE" && (
          <span className="absolute left-1.5 top-1.5">
            <LiveDot />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{live.title}</p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              live.status === "LIVE"
                ? "bg-red-500/15 text-red-400"
                : live.status === "ENDED"
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-gold/15 text-gold-bright"
            )}
          >
            {live.status === "LIVE" ? "En vivo" : live.status === "ENDED" ? "Finalizado" : "Programado"}
          </span>
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {format(new Date(live.scheduledAt), "EEE d MMM yyyy · h:mm a", { locale: es })}
        </p>
        {live.streamUrl && (
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-zinc-500">
            <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {live.streamUrl}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap gap-2">
          {live.status !== "LIVE" && (
            <Button
              type="button"
              size="sm"
              className="btn-gold h-8 px-3 text-xs font-semibold"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ status: "LIVE" })}
            >
              <Radio aria-hidden /> Activar EN VIVO
            </Button>
          )}
          {live.status === "LIVE" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-zinc-800 px-3 text-xs"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ status: "ENDED" })}
            >
              <Square className="h-3.5 w-3.5" aria-hidden /> Finalizar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-zinc-800 px-3 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
          </Button>
        </div>

        {live.status !== "SCHEDULED" && (
          <div className="mt-2.5 flex gap-2">
            <Input
              placeholder="Link de la grabación (YouTube o mp4)"
              className="h-8 border-zinc-800 bg-zinc-950/70 text-xs"
              value={replayUrl}
              onChange={(e) => setReplayUrl(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 border-zinc-800 px-3 text-xs"
              disabled={savingReplay}
              onClick={() => void saveReplay()}
            >
              {savingReplay ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Guardar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function LiveManager() {
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery<{ lives: LiveSessionDTO[] }>({
    queryKey: ["admin-lives"],
    queryFn: () => adminFetch<{ lives: LiveSessionDTO[] }>("/api/admin/live"),
  })

  const lives = data?.lives ?? []

  return (
    <div className="space-y-4">
      <Card className="gap-0 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-500" aria-hidden />
            <h3 className="font-display text-base font-semibold text-zinc-100">Canal En Vivo</h3>
          </div>
          <Button type="button" size="sm" className="btn-gold font-semibold" onClick={() => setCreating((v) => !v)}>
            <Plus aria-hidden />
            {creating ? "Cerrar formulario" : "Nueva transmisión"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Programa un live, súbele su imagen 16:9 y la reseña; actívalo con "Activar EN VIVO" y el punto rojo
          titilante aparecerá en el menú de toda la comunidad.
        </p>

        {creating && (
          <div className="animate-view mt-4 border-t border-zinc-800/70 pt-4">
            <CreateForm onDone={() => setCreating(false)} />
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : lives.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <MonitorPlay className="mx-auto h-10 w-10 text-zinc-600" aria-hidden />
          <p className="mt-3 text-sm text-zinc-400">Aún no hay transmisiones. Crea la primera con "Nueva transmisión".</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {lives.map((l) => (
            <LiveRow key={l.id} live={l} />
          ))}
        </div>
      )}
    </div>
  )
}

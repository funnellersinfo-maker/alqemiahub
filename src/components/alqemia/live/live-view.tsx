"use client"

// ============================================================
// EN VIVO — Canal de transmisiones del gremio
// · Si hay live: punto rojo titilante + reproductor grande
// · Si no: "Próximamente" con fecha, imagen 16:9 y reseña
// · Grabaciones de lives pasados
// ============================================================

import { useQuery } from "@tanstack/react-query"
import { CalendarClock, Loader2, MonitorPlay, Play, Radio, VideoOff } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState } from "react"
import { useMe } from "@/hooks/use-me"
import { cn } from "@/lib/utils"
import type { LiveResponse, LiveSessionDTO } from "@/lib/types"

/** Punto rojo mágico: titila con brillo mientras hay transmisión */
export function LiveDot({ className, label = "EN VIVO" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2.5 w-2.5" aria-hidden>
        <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600 shadow-[0_0_10px_2px_rgba(239,68,68,0.8)]" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-red-500">{label}</span>
    </span>
  )
}

/** Extrae el ID de video de YouTube de los formatos comunes. */
function youtubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=)([\w-]{11})/i,
    /(?:youtu\.be\/)([\w-]{11})/i,
    /(?:youtube\.com\/embed\/)([\w-]{11})/i,
    /(?:youtube\.com\/live\/)([\w-]{11})/i,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function isDirectVideo(url: string): boolean {
  return /\.mp4(\?|$)/i.test(url)
}

/** Reproductor: YouTube → iframe embebido; Meet/Zoom → botón Unirse; mp4 → <video> */
function LivePlayer({ url, title, autoplay = false }: { url: string; title: string; autoplay?: boolean }) {
  const ytId = youtubeId(url)
  if (ytId) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=${autoplay ? 1 : 0}&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    )
  }
  if (isDirectVideo(url)) {
    return (
      <video controls autoPlay={autoplay} className="aspect-video w-full rounded-2xl border border-zinc-800 bg-black">
        <source src={url} />
        Tu navegador no soporta el video.
      </video>
    )
  }
  // Meet / Zoom / cualquier otro: botón para unirse en nueva pestaña
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center">
      <Radio className="h-10 w-10 text-red-500" aria-hidden />
      <p className="max-w-sm text-sm text-zinc-400">
        La transmisión se realiza en una sala externa. Pulsa para unirte:
      </p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button className="btn-gold font-semibold">Unirme a la transmisión</Button>
      </a>
    </div>
  )
}

function formatLiveDate(iso: string): string {
  return format(new Date(iso), "EEEE d 'de' MMMM · h:mm a", { locale: es })
}

function Countdown({ iso }: { iso: string }) {
  const [, tick] = useState(0)
  // Re-render cada minuto para el contador
  useQuery({
    queryKey: ["countdown-tick"],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 60_000))
      return Date.now()
    },
    refetchInterval: 60_000,
  })
  void tick
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "¡Comienza ya!"
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${mins}min`)
  return `Empieza en ${parts.join(" ")}`
}

function ReplayCard({ live }: { live: LiveSessionDTO }) {
  const [open, setOpen] = useState(false)
  const url = live.replayUrl ?? ""

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 text-left transition-all hover:border-gold/40 hover:shadow-[0_0_28px_-10px_rgba(212,175,55,0.4)]"
        aria-label={`Ver grabación: ${live.title}`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
          {live.coverImage ? (
            <img
              src={live.coverImage}
              alt={`Portada de la grabación: ${live.title}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MonitorPlay className="h-8 w-8 text-zinc-700" aria-hidden />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-zinc-950 shadow-[0_0_30px_-4px_rgba(212,175,55,0.8)]">
              <Play className="ml-0.5 h-5 w-5 fill-zinc-950" aria-hidden />
            </span>
          </span>
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 backdrop-blur">
            Grabación
          </span>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-semibold text-zinc-200">{live.title}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {format(new Date(live.scheduledAt), "d MMM yyyy · h:mm a", { locale: es })}
          </p>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-zinc-100">{live.title}</DialogTitle>
            <DialogDescription>
              {format(new Date(live.scheduledAt), "EEEE d 'de' MMMM · h:mm a", { locale: es })}
            </DialogDescription>
          </DialogHeader>
          {url ? (
            <LivePlayer url={url} title={live.title} autoplay />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-500">
              <span className="flex items-center gap-2">
                <VideoOff className="h-4 w-4" aria-hidden /> Grabación próximamente disponible
              </span>
            </div>
          )}
          {live.description && <p className="whitespace-pre-wrap text-sm text-zinc-400">{live.description}</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}

export function LiveView() {
  const { data: me } = useMe()
  const isAdmin = me?.user.role === "ADMIN"

  const { data, isLoading } = useQuery<LiveResponse>({
    queryKey: ["live"],
    queryFn: async () => {
      const res = await fetch("/api/live")
      if (!res.ok) throw new Error("No se pudo cargar el canal EN VIVO")
      return res.json()
    },
    refetchInterval: 60_000, // el estado del live se refresca cada minuto
  })

  const current = data?.current ?? null
  const next = data?.next ?? null
  const replays = data?.replays ?? []

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">En Vivo</h1>
            {current ? <LiveDot /> : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Transmisiones y masterclasses del gremio, en directo y en grabación.
          </p>
        </div>
      </header>

      <div className="mt-5 space-y-6">
        {isLoading ? (
          <>
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Skeleton className="aspect-video rounded-2xl" />
              <Skeleton className="aspect-video rounded-2xl" />
              <Skeleton className="aspect-video rounded-2xl" />
            </div>
          </>
        ) : current ? (
          // ---------- TRANSMISIÓN EN VIVO ----------
          <section aria-label="Transmisión en vivo">
            <Card className="gate-card gap-0 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <h2 className="font-display text-lg font-semibold text-zinc-100">{current.title}</h2>
                <LiveDot />
              </div>
              {current.streamUrl ? (
                <LivePlayer url={current.streamUrl} title={current.title} autoplay />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80">
                  <Loader2 className="h-8 w-8 animate-spin text-gold/60" aria-label="Cargando transmisión" />
                </div>
              )}
              {current.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{current.description}</p>
              )}
            </Card>
          </section>
        ) : next ? (
          // ---------- PRÓXIMA TRANSMISIÓN ----------
          <section aria-label="Próxima transmisión">
            <Card className="gate-card gap-0 overflow-hidden rounded-2xl p-0">
              <div className="relative aspect-video w-full bg-zinc-900">
                {next.coverImage ? (
                  <img
                    src={next.coverImage}
                    alt={`Anuncio de la próxima transmisión: ${next.title}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
                    <CalendarClock className="h-10 w-10 text-gold/70" aria-hidden />
                    <p className="font-display text-xl font-semibold text-zinc-200">{next.title}</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-14">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-bright">
                      Próximamente
                    </span>
                    <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur">
                      <Countdown iso={next.scheduledAt} />
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <h2 className="font-display text-lg font-semibold text-zinc-100">{next.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gold-bright">
                  <CalendarClock className="h-4 w-4" aria-hidden />
                  {formatLiveDate(next.scheduledAt)}
                </p>
                {next.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{next.description}</p>
                )}
              </div>
            </Card>
          </section>
        ) : (
          // ---------- SIN TRANSMISIONES ----------
          <section aria-label="Sin transmisiones programadas">
            <Card className="gate-card flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30">
                <MonitorPlay className="h-8 w-8 text-gold-bright" aria-hidden />
              </span>
              <h2 className="font-display text-xl font-semibold text-zinc-100">
                Aún no hay transmisiones programadas
              </h2>
              <p className="max-w-sm text-sm text-zinc-500">
                Cuando el equipo ALQEMIA programe un live, verás aquí el anuncio con fecha y hora.
                {isAdmin ? " Publícalo desde tu Panel de Administración → En Vivo." : ""}
              </p>
            </Card>
          </section>
        )}

        {/* ---------- GRABACIONES ---------- */}
        {replays.length > 0 && (
          <section aria-label="Grabaciones de lives pasados">
            <h2 className="font-display text-lg font-semibold text-zinc-100">Grabaciones</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Todos los lives del gremio, guardados para ti.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {replays.map((r) => (
                <ReplayCard key={r.id} live={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

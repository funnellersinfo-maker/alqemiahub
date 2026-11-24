"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Loader2, MessageSquare, PlayCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/alqemia/empty-state"
import { SmartVideo } from "@/components/alqemia/smart-video"
import type { FeedPost, FeedResponse } from "@/lib/types"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"
import { PostCard } from "./post-card"
import { PostComposer } from "./post-composer"

function FeedSkeletons() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="gap-0 rounded-2xl border-zinc-800 bg-zinc-950 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pt-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="mt-4 flex gap-2 border-t border-zinc-800 pt-3">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  )
}

/** Extrae la URL de embed de YouTube (watch / youtu.be / embed) o null. */
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

/**
 * Vídeo del titular: lo carga el jefe desde su Panel Admin (Ajustes)
 * y aparece entre el título del muro y la caja de escribir.
 */
function MuroVideo() {
  const { data } = useQuery<{ video: string | null; poster: string | null }>({
    queryKey: ["muro-video"],
    queryFn: async () => {
      const [v, p] = await Promise.all([
        fetch("/api/settings?key=muro_video"),
        fetch("/api/settings?key=muro_video_poster"),
      ])
      const video = v.ok ? ((await v.json()) as { value: string | null }).value : null
      const poster = p.ok ? ((await p.json()) as { value: string | null }).value : null
      return { video, poster }
    },
    staleTime: 60_000,
  })

  const url = data?.video?.trim() ?? ""
  const poster = data?.poster?.trim() ?? ""
  if (!url) return null

  const embed = youtubeEmbed(url)
  const isDirectVideo =
    url.startsWith("/api/media/") || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)

  return (
    <section
      className="gate-card mt-4 overflow-hidden rounded-2xl"
      aria-label="Mensaje en vídeo del titular"
    >
      <div className="flex items-center gap-2 border-b border-gold/20 px-4 py-2.5">
        <PlayCircle className="h-4 w-4 text-gold" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/80">
          Mensaje del Titular
        </p>
      </div>
      {embed ? (
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={embed}
            title="Mensaje del titular"
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : isDirectVideo ? (
        <SmartVideo
          src={url}
          poster={poster || null}
          videoClassName="max-h-[70vh]"
          offline={url.startsWith("/api/media/")}
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-4 text-sm font-medium text-gold-bright transition-colors hover:text-gold"
        >
          <PlayCircle className="h-5 w-5 shrink-0" aria-hidden />
          Ver el mensaje del titular
        </a>
      )}
    </section>
  )
}

export function FeedView() {
  const query = useInfiniteQuery<FeedResponse, Error>({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) =>
      fetch(`/api/feed?cursor=${pageParam ?? ""}`).then((res) => {
        if (!res.ok) throw new Error("feed-error")
        return res.json() as Promise<FeedResponse>
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 20000,
  })

  const posts: FeedPost[] = query.data ? query.data.pages.flatMap((page) => page.posts) : []
  const isEmpty = !query.isLoading && !query.isError && posts.length === 0

  return (
    <div className="mx-auto w-full max-w-2xl pb-4">
      <header className="mb-4">
        <h1 className="text-2xl">
          <AlqemiaLetters text="El Muro" strokeWidth={8} />
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Comparte avances, preguntas y victorias de tu negocio.
        </p>
      </header>

      {/* Vídeo opcional cargado por el titular desde su Panel Admin */}
      <MuroVideo />

      <div className="mt-4">
        <PostComposer />
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <FeedSkeletons />
        ) : query.isError || isEmpty ? (
          <EmptyState
            icon={MessageSquare}
            title="El muro está en silencio"
            description="Sé quien rompa el hielo: comparte tu primer avance o pregunta."
            action={
              query.isError ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void query.refetch()}
                >
                  Reintentar
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      {query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Cargar más publicaciones
        </Button>
      )}
    </div>
  )
}

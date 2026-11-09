"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/alqemia/empty-state"
import type { FeedPost, FeedResponse } from "@/lib/types"
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
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
          El Muro
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Comparte avances, preguntas y victorias de tu negocio.
        </p>
      </header>

      <PostComposer />

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

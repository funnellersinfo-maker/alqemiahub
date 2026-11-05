"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Heart, Loader2, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/alqemira/avatar"
import { LevelBadge } from "@/components/alqemira/level-badge"
import { CommentsSection } from "./comments-section"
import { getLevelInfo } from "@/lib/levels"
import { timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { FeedPost, FeedResponse } from "@/lib/types"

// Representación local del InfiniteData del feed (evita importar tipos de RQ)
type FeedPages = { pages: FeedResponse[]; pageParams: unknown[] }
type LikeResponse = { liked: boolean; likeCount: number }

export function PostCard({ post }: { post: FeedPost }) {
  const queryClient = useQueryClient()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  /** Actualiza el post actual dentro de la caché del feed (todas las páginas). */
  const patchPostInFeed = (patch: (p: FeedPost) => FeedPost) => {
    queryClient.setQueriesData<FeedPages>({ queryKey: ["feed"] }, (old) => {
      try {
        if (!old || !Array.isArray(old.pages)) return old
        return {
          ...old,
          pages: old.pages.map((page) =>
            Array.isArray(page?.posts)
              ? { ...page, posts: page.posts.map((p) => (p.id === post.id ? patch(p) : p)) }
              : page
          ),
        }
      } catch {
        return old
      }
    })
  }

  const likeMutation = useMutation<LikeResponse, Error, void, unknown>({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" })
      if (!res.ok) throw new Error("like-error")
      return (await res.json()) as LikeResponse
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["feed"] })
      const previous = queryClient.getQueryData(["feed"])
      // Actualización optimista: invertir like localmente
      patchPostInFeed((p) => ({
        ...p,
        likedByMe: !p.likedByMe,
        likeCount: p.likedByMe ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
      }))
      return previous
    },
    onError: (_error, _variables, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(["feed"], context)
      }
      toast.error("No se pudo actualizar tu reacción")
    },
    onSuccess: (data) => {
      // Sincronizar con la respuesta real del servidor
      patchPostInFeed((p) => ({ ...p, likedByMe: data.liked, likeCount: data.likeCount }))
    },
    onSettled: () => {
      // Invalidar sin refetch para no perder la posición del scroll
      void queryClient.invalidateQueries({ queryKey: ["feed"], refetchType: "none" })
    },
  })

  const deleteMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("delete-error")
    },
    onSuccess: () => {
      setDeleteOpen(false)
      toast.success("Publicación eliminada")
      void queryClient.invalidateQueries({ queryKey: ["feed"] })
    },
    onError: () => {
      toast.error("No se pudo eliminar la publicación")
    },
  })

  const meta = post.user.headline
    ? `${post.user.headline} · ${timeAgo(post.createdAt)}`
    : timeAgo(post.createdAt)

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border-zinc-200 bg-white p-4 sm:p-5">
      <article>
        <div className="flex items-start gap-3">
          <UserAvatar user={post.user} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-[15px] text-zinc-900">
                {post.user.name}
              </span>
              <LevelBadge level={getLevelInfo(post.user.xp)} className="shrink-0" />
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{meta}</p>
          </div>
          {post.isOwn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-zinc-500 hover:text-zinc-900"
                  aria-label="Más opciones"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 aria-hidden />
                  Eliminar publicación
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <p className="mt-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-zinc-800">
          {post.content}
        </p>

        {post.image && (
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            { }
            <img
              src={post.image}
              alt="Imagen de la publicación"
              className="max-h-[480px] w-full object-cover"
            />
          </div>
        )}

        <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={post.likedByMe}
            disabled={likeMutation.isPending}
            onClick={() => likeMutation.mutate()}
            className={cn(
              post.likedByMe
                ? "text-amber-600 hover:text-amber-600"
                : "text-zinc-500 hover:text-amber-600"
            )}
          >
            <Heart
              className={cn("h-4 w-4", post.likedByMe && "fill-amber-500 text-amber-500")}
              aria-hidden
            />
            {post.likeCount}
            <span className="hidden sm:inline">Me gusta</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={commentsOpen}
            onClick={() => setCommentsOpen((v) => !v)}
            className={cn(
              "text-zinc-500 hover:text-zinc-900",
              commentsOpen && "bg-zinc-100 text-zinc-900"
            )}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {post.commentCount}
            <span className="hidden sm:inline">Comentar</span>
          </Button>
        </div>

        {commentsOpen && (
          <CommentsSection
            postId={post.id}
            onCommentPosted={() => {
              void queryClient.invalidateQueries({ queryKey: ["feed"], refetchType: "none" })
            }}
          />
        )}
      </article>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleteMutation.isPending) setDeleteOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta publicación?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate()
              }}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

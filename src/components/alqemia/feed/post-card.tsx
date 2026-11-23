"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  BadgeCheck,
  DollarSign,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Package,
  Trash2,
  TrendingUp,
} from "lucide-react"
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
import { UserAvatar } from "@/components/alqemia/avatar"
import { LevelBadge } from "@/components/alqemia/level-badge"
import { CommentsSection } from "./comments-section"
import { getDisplayLevel } from "@/lib/levels"
import { timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { FeedPost, FeedResponse } from "@/lib/types"

// Representación local del InfiniteData del feed (evita importar tipos de RQ)
type FeedPages = { pages: FeedResponse[]; pageParams: unknown[] }
type LikeResponse = { liked: boolean; likeCount: number }

// Formato compacto es-ES para las cifras de facturación (ej. 12,3 mil)
const compactFmt = new Intl.NumberFormat("es", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold-bright"

/** Abre el perfil público del miembro (el app-shell escucha este evento). */
function openProfile(userId: string) {
  window.dispatchEvent(new CustomEvent("alqemia:open-profile", { detail: userId }))
}

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

  const hasMetrics =
    post.metricRevenue !== null || post.metricOrders !== null || post.metricRoas !== null

  return (
    <Card className="hover-lift gap-0 overflow-hidden rounded-2xl border-zinc-800 bg-zinc-950 p-4 sm:p-5">
      <article>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => openProfile(post.user.id)}
            aria-label={`Ver perfil de ${post.user.name}`}
            className="shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <UserAvatar user={post.user} size="md" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                type="button"
                onClick={() => openProfile(post.user.id)}
                aria-label={`Ver perfil de ${post.user.name}`}
                className="max-w-full cursor-pointer break-words text-left font-semibold text-[15px] leading-tight text-zinc-100 transition-colors hover:text-gold-bright focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40"
              >
                {post.user.name}
              </button>
              {post.user.verified && (
                <BadgeCheck
                  className="h-3.5 w-3.5 shrink-0 fill-sky-400 text-zinc-950"
                  aria-label="Cuenta verificada"
                />
              )}
              <LevelBadge level={getDisplayLevel(post.user)} className="shrink-0" />
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
                  className="h-8 w-8 shrink-0 text-zinc-500 hover:text-zinc-100"
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

        <p className="mt-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-zinc-200">
          {post.content}
        </p>

        {post.image && (
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
            { }
            <img
              src={post.image}
              alt="Imagen de la publicación"
              className="max-h-[480px] w-full object-cover"
            />
          </div>
        )}

        {hasMetrics && (
          <div className="mt-3">
            <div className="flex items-center gap-2" aria-hidden>
              <span className="text-[9px] font-semibold tracking-[0.2em] text-gold/60">
                EVIDENCIA
              </span>
              <span className="h-px flex-1 bg-gold/20" />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {post.metricRevenue !== null && (
                <span className={CHIP_CLASS} title="Facturación reportada">
                  <DollarSign className="h-3 w-3" aria-hidden />
                  {"+"}
                  {compactFmt.format(post.metricRevenue)}
                </span>
              )}
              {post.metricOrders !== null && (
                <span className={CHIP_CLASS} title="Pedidos reportados">
                  <Package className="h-3 w-3" aria-hidden />
                  {post.metricOrders} pedidos
                </span>
              )}
              {post.metricRoas !== null && (
                <span className={CHIP_CLASS} title="Retorno sobre inversión publicitaria">
                  <TrendingUp className="h-3 w-3" aria-hidden />
                  ROAS x{post.metricRoas.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-1 border-t border-zinc-800 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={post.likedByMe}
            disabled={likeMutation.isPending}
            onClick={() => likeMutation.mutate()}
            className={cn(
              post.likedByMe
                ? "text-gold hover:text-gold"
                : "text-zinc-500 hover:text-gold"
            )}
          >
            <Heart
              className={cn("h-4 w-4", post.likedByMe && "fill-gold-deep text-gold-deep")}
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
              "text-zinc-500 hover:text-zinc-100",
              commentsOpen && "bg-zinc-900 text-zinc-100"
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

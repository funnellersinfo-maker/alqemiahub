"use client"

import { useState, type FormEvent, type KeyboardEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { UserAvatar } from "@/components/alqemira/avatar"
import { useMe } from "@/hooks/use-me"
import { celebrateXp } from "@/lib/store"
import { timeAgo } from "@/lib/time"
import type { FeedComment, XpEvent } from "@/lib/types"

type CommentsResponse = { comments: FeedComment[] }
type CreateCommentResponse = { comment?: FeedComment; xp?: XpEvent; error?: string }

export function CommentsSection({
  postId,
  onCommentPosted,
}: {
  postId: string
  onCommentPosted?: () => void
}) {
  const queryClient = useQueryClient()
  const me = useMe()
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  const commentsQuery = useQuery<CommentsResponse, Error>({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${postId}/comments`)
      if (!res.ok) throw new Error("comments-error")
      return (await res.json()) as CommentsResponse
    },
  })

  const comments = commentsQuery.data?.comments ?? []
  const meUser = me.data?.user

  async function submitComment() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const json = (await res.json()) as CreateCommentResponse
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo publicar el comentario")
        return
      }
      setText("")
      void queryClient.invalidateQueries({ queryKey: ["post-comments", postId] })
      celebrateXp(json.xp)
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      onCommentPosted?.()
    } catch {
      toast.error("Error de red. Inténtalo de nuevo")
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submitComment()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void submitComment()
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 sm:p-4">
      {commentsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5 pt-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full max-w-[220px]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {comments.length > 0 && (
            <p className="mb-2 text-[11px] text-zinc-400">
              {comments.length} {comments.length === 1 ? "comentario" : "comentarios"}
            </p>
          )}
          <div className="thin-scrollbar max-h-80 space-y-3 overflow-y-auto">
            {commentsQuery.isError ? (
              <p className="py-2 text-xs text-zinc-400">
                No se pudieron cargar los comentarios.
              </p>
            ) : comments.length === 0 ? (
              <p className="py-2 text-xs text-zinc-400">
                Aún no hay comentarios. Sé el primero en responder.
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <UserAvatar user={comment.user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="mr-1.5 font-semibold text-zinc-900">{comment.user.name}</span>
                      <span className="break-words text-zinc-700">{comment.content}</span>
                    </p>
                    <span className="text-[11px] text-zinc-400">{timeAgo(comment.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <form
        className="mt-3 flex items-center gap-2 border-t border-zinc-200/70 pt-3"
        onSubmit={handleSubmit}
      >
        {meUser ? (
          <UserAvatar user={meUser} size="xs" />
        ) : (
          <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
        )}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un comentario..."
          aria-label="Escribe un comentario"
          className="h-9 border-zinc-200 bg-white"
        />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={!text.trim() || sending}
          aria-label="Enviar comentario"
          className="shrink-0 font-medium"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Responder
        </Button>
      </form>
    </div>
  )
}

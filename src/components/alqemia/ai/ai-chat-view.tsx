"use client"

// ============================================================
// EL ORÁCULO — Asistente IA del Hub (tipo ChatGPT interno)
// Multi-turno con historial persistente en la BD del miembro.
// El modelo vive en el backend (/api/ai/chat, z-ai-web-dev-sdk).
// ============================================================

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Sparkles, Eraser, Loader2, Send, User } from "lucide-react"
import Markdown from "react-markdown"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/alqemia/avatar"
import { useMe } from "@/hooks/use-me"
import { cn } from "@/lib/utils"
import type { ChatMsg } from "@/lib/types"

const SUGGESTIONS = [
  "Dame 5 ideas de contenido para vender en redes esta semana",
  "Arma un copy de venta para mi producto estrella",
  "¿Cómo estructuro mi primer embudo de venta paso a paso?",
  "Escríbeme un guion de TikTok de 30 segundos para captar leads",
  "Revísame este precio: ¿cómo sé si debo subirlo?",
]

function MessageBubble({ msg, name, image, avatarColor }: { msg: ChatMsg } & { name: string; image: string | null; avatarColor: string | null }) {
  const isUser = msg.role === "user"
  return (
    <div className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
          <Sparkles className="h-3.5 w-3.5 text-gold-bright" aria-hidden />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
          isUser
            ? "rounded-br-md bg-gradient-to-br from-gold to-gold-deep font-medium text-zinc-950"
            : "rounded-bl-md border border-zinc-800 bg-zinc-950/80 text-zinc-200"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="oracle-md">
            <Markdown>{msg.content}</Markdown>
          </div>
        )}
      </div>
      {isUser && (
        <span className="mt-1 shrink-0">
          <UserAvatar user={{ name, image, avatarColor }} size="xs" />
        </span>
      )}
    </div>
  )
}

export function AiChatView() {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const user = me?.user
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<{ messages: ChatMsg[] }>({
    queryKey: ["ai-chat"],
    queryFn: async () => {
      const res = await fetch("/api/ai/chat")
      if (!res.ok) throw new Error("No se pudo cargar la conversación")
      return res.json()
    },
  })

  const messages = data?.messages ?? []

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "El Oráculo no pudo responder")
      }
      return res.json() as Promise<{ reply: ChatMsg }>
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-chat"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/chat", { method: "DELETE" })
      if (!res.ok) throw new Error("No se pudo limpiar la conversación")
    },
    onSuccess: () => {
      toast.success("Nueva conversación iniciada")
      void queryClient.invalidateQueries({ queryKey: ["ai-chat"] })
    },
    onError: () => toast.error("No se pudo limpiar la conversación"),
  })

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, pending])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || pending) return
    setInput("")
    setPending(true)
    try {
      await sendMutation.mutateAsync(text)
    } finally {
      setPending(false)
    }
  }

  function quickAsk(q: string) {
    if (pending) return
    setInput(q)
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-3xl flex-col lg:h-[calc(100dvh-6rem)]">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/40">
              <Sparkles className="h-5 w-5 text-gold-bright" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold leading-tight tracking-tight">El Oráculo</h1>
              <p className="text-xs text-zinc-500">Tu asistente IA de marketing, 24/7</p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-800 text-zinc-400 hover:text-zinc-200"
            disabled={clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
          >
            {clearMutation.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Eraser aria-hidden />}
            Nueva conversación
          </Button>
        )}
      </header>

      <Card className="gate-card mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-0">
        {/* Mensajes */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" role="log" aria-label="Conversación con El Oráculo">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 shadow-[0_0_40px_-8px_rgba(212,175,55,0.6)] ring-1 ring-gold/40">
                <Sparkles className="h-8 w-8 text-gold-bright" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-zinc-100">Pregúntale lo que sea</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                  Copys, ideas de contenido, embudos, precios, estrategias… El Oráculo es tu socio de marketing.
                </p>
              </div>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => quickAsk(s)}
                    className="rounded-full border border-zinc-800 px-3.5 py-1.5 text-xs text-zinc-400 transition-all hover:border-gold/40 hover:text-gold-bright"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  name={user?.name ?? "Tú"}
                  image={user?.image ?? null}
                  avatarColor={user?.avatarColor ?? null}
                />
              ))}
            </>
          )}
          {pending && (
            <div className="flex gap-2.5">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-gold-bright" aria-hidden />
              </span>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-950/80 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:300ms]" />
                <span className="sr-only">El Oráculo está pensando…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Entrada */}
        <form onSubmit={handleSubmit} className="border-t border-zinc-800/80 p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              maxLength={8000}
              placeholder="Pregúntale algo a El Oráculo…"
              className="max-h-32 min-h-11 resize-none border-zinc-800 bg-zinc-950/70 focus-visible:border-gold/50 focus-visible:ring-gold/25"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit(e)
                }
              }}
            />
            <Button
              type="submit"
              className="btn-gold h-11 w-11 shrink-0 p-0 font-semibold"
              disabled={pending || input.trim().length === 0}
              aria-label="Enviar mensaje"
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-zinc-600">
            Enter para enviar · Shift+Enter para salto de línea
          </p>
        </form>
      </Card>
    </div>
  )
}

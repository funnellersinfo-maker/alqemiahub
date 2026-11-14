"use client"

// ============================================================
// EL ORÁCULO — Asistente IA del Hub (tipo ChatGPT interno)
// Fluidéz tipo WhatsApp:
//  · El mensaje sale AL INSTANTE (eco optimista)
//  · La respuesta llega EN VIVO, palabra por palabra (streaming)
//  · Toggle "Internet": busca en la web antes de responder
//    y muestra las fuentes usadas
// Historial persistente en la BD del miembro.
// ============================================================

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Sparkles, Eraser, Send, Globe, ExternalLink, AlertTriangle } from "lucide-react"
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
  "¿Qué tendencias de ecommerce hay ahora? (activa Internet)",
]

type Phase = "idle" | "sending" | "searching" | "streaming"
type Source = { title: string; url: string }

type StreamEvent =
  | { t: "user"; msg: ChatMsg }
  | { t: "searching" }
  | { t: "sources"; results: Source[] }
  | { t: "delta"; v: string }
  | { t: "done"; msg: ChatMsg }
  | { t: "error"; error: string }

function MessageBubble({
  msg,
  name,
  image,
  avatarColor,
}: {
  msg: ChatMsg
} & {
  name: string
  image: string | null
  avatarColor: string | null
}) {
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

/** Burbuja en vivo: el texto del stream + cursor titilante + fuentes web. */
function StreamingBubble({ text, sources }: { text: string; sources: Source[] }) {
  return (
    <div className="flex w-full gap-2.5">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
        <Sparkles className="h-3.5 w-3.5 animate-pulse text-gold-bright" aria-hidden />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-sm leading-relaxed text-zinc-200 sm:max-w-[75%]">
        {sources.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-zinc-800 pb-2">
            <Globe className="h-3 w-3 text-gold" aria-hidden />
            {sources.map((s, i) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.title}
                className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold-bright transition-colors hover:bg-gold/20"
              >
                [{i + 1}] {new URL(s.url).hostname.replace("www.", "")}
                <ExternalLink className="h-2.5 w-2.5" aria-hidden />
              </a>
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">
          {text}
          <span className="oracle-cursor" aria-hidden />
        </p>
      </div>
    </div>
  )
}

export function AiChatView() {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const user = me?.user
  const [input, setInput] = useState("")
  const [web, setWeb] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [optimistic, setOptimistic] = useState<ChatMsg | null>(null)
  const [streamText, setStreamText] = useState("")
  const [sources, setSources] = useState<Source[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const busy = phase !== "idle"

  const { data, isLoading } = useQuery<{ messages: ChatMsg[] }>({
    queryKey: ["ai-chat"],
    queryFn: async () => {
      const res = await fetch("/api/ai/chat")
      if (!res.ok) throw new Error("No se pudo cargar la conversación")
      return res.json()
    },
  })

  const messages = data?.messages ?? []

  /** Añade mensajes ya confirmados por el servidor a la caché (sin refetch). */
  const appendToCache = useCallback(
    (...msgs: ChatMsg[]) => {
      queryClient.setQueryData<{ messages: ChatMsg[] }>(["ai-chat"], (old) =>
        old ? { messages: [...old.messages, ...msgs] } : { messages: msgs }
      )
    },
    [queryClient]
  )

  // Auto-scroll al último mensaje / al texto que crece
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, streamText, phase, optimistic, streamError])

  async function send(text: string) {
    if (busy) return
    const now = new Date().toISOString()
    setOptimistic({ id: `tmp-${now}`, role: "user", content: text, createdAt: now })
    setPhase("sending")
    setStreamText("")
    setSources([])
    setStreamError(null)

    let userConfirmed: ChatMsg | null = null
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, web }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "El Oráculo no pudo responder")
      }
      if (!res.body) throw new Error("El Oráculo no pudo responder")

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
      let acc = ""
      let doneMsg: ChatMsg | null = null
      let streamErr: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let ev: StreamEvent
          try {
            ev = JSON.parse(trimmed) as StreamEvent
          } catch {
            continue
          }
          if (ev.t === "user") {
            userConfirmed = ev.msg
          } else if (ev.t === "searching") {
            setPhase("searching")
          } else if (ev.t === "sources") {
            setSources(ev.results.slice(0, 5))
          } else if (ev.t === "delta") {
            acc += ev.v
            setStreamText(acc)
            setPhase("streaming")
          } else if (ev.t === "done") {
            doneMsg = ev.msg
          } else if (ev.t === "error") {
            streamErr = ev.error
          }
        }
      }

      if (doneMsg) {
        // Confirmar en caché: mensaje del usuario + respuesta completa
        const toAppend = userConfirmed ? [userConfirmed, doneMsg] : [doneMsg]
        appendToCache(...toAppend)
        void queryClient.invalidateQueries({ queryKey: ["ai-chat"] })
      } else if (streamErr) {
        // El mensaje del usuario quedó guardado; el error se muestra inline
        if (userConfirmed) appendToCache(userConfirmed)
        setStreamError(streamErr)
        toast.error(streamErr)
      } else if (acc) {
        // Stream cortado sin done: se muestra lo recibido como final
        appendToCache({
          id: `tmp-a-${now}`,
          role: "assistant",
          content: acc,
          createdAt: new Date().toISOString(),
        })
      } else {
        throw new Error("El Oráculo no respondió. Intenta de nuevo.")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "El Oráculo no pudo responder"
      setStreamError(msg)
      toast.error(msg)
    } finally {
      setOptimistic(null)
      setStreamText("")
      setSources([])
      setPhase("idle")
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput("")
    await send(text)
  }

  async function clearConversation() {
    try {
      const res = await fetch("/api/ai/chat", { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Nueva conversación iniciada")
      void queryClient.invalidateQueries({ queryKey: ["ai-chat"] })
    } catch {
      toast.error("No se pudo limpiar la conversación")
    }
  }

  function quickAsk(q: string) {
    if (busy) return
    // Si la sugerencia es de tendencias/actualidad, activa Internet solo
    if (/tendencias|actual|ahora|esta semana|hoy/i.test(q)) setWeb(true)
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
              <p className="text-xs text-zinc-500">
                {phase === "searching"
                  ? "Buscando en internet…"
                  : phase === "streaming"
                    ? "Escribiendo…"
                    : "Tu asistente IA de marketing, 24/7"}
              </p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-800 text-zinc-400 hover:text-zinc-200"
            onClick={() => void clearConversation()}
          >
            <Eraser aria-hidden />
            Nueva conversación
          </Button>
        )}
      </header>

      <Card className="gate-card mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-0">
        {/* Mensajes */}
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
          role="log"
          aria-label="Conversación con El Oráculo"
          aria-live="polite"
        >
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
            </div>
          ) : messages.length === 0 && !optimistic ? (
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

          {/* Eco optimista: el mensaje del usuario sale al instante */}
          {optimistic && (
            <MessageBubble
              msg={optimistic}
              name={user?.name ?? "Tú"}
              image={user?.image ?? null}
              avatarColor={user?.avatarColor ?? null}
            />
          )}

          {/* Estado en vivo del Oráculo */}
          {(phase === "sending" || phase === "searching") && streamText === "" && (
            <div className="flex gap-2.5">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-gold-bright" aria-hidden />
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-950/80 px-4 py-3">
                {phase === "searching" ? (
                  <>
                    <Globe className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden />
                    <span className="text-xs text-zinc-400">Buscando en internet…</span>
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:300ms]" />
                  </>
                )}
                <span className="sr-only">El Oráculo está pensando…</span>
              </div>
            </div>
          )}

          {/* Respuesta en vivo (streaming) */}
          {(phase === "streaming" || phase === "searching") && streamText !== "" && (
            <StreamingBubble text={streamText} sources={sources} />
          )}
          {phase === "streaming" && streamText === "" && null}

          {/* Error inline (el hilo no se rompe, estilo WhatsApp) */}
          {streamError && (
            <div className="flex justify-center">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {streamError}
              </p>
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
            {/* Toggle Internet: busca en la web antes de responder */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeb((w) => !w)}
              aria-pressed={web}
              title={web ? "Internet activado: buscará en la web antes de responder" : "Activar búsqueda en internet"}
              className={cn(
                "h-11 shrink-0 gap-1.5 border-zinc-800 px-3 text-xs font-medium transition-all",
                web
                  ? "border-gold/50 bg-gold/15 text-gold-bright shadow-[0_0_14px_-4px_rgba(212,175,55,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Globe className={cn("h-4 w-4", web && "text-gold")} aria-hidden />
              <span className="hidden sm:inline">Internet</span>
            </Button>
            <Button
              type="submit"
              className="btn-gold h-11 w-11 shrink-0 p-0 font-semibold"
              disabled={busy || input.trim().length === 0}
              aria-label="Enviar mensaje"
            >
              <Send aria-hidden />
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-zinc-600">
            Enter para enviar · Shift+Enter para salto de línea
            {web && <span className="text-gold/80"> · Internet activado: responderá con fuentes de la web</span>}
          </p>
        </form>
      </Card>
    </div>
  )
}

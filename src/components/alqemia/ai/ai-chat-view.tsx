"use client"

// ============================================================
// EL ORÁCULO — Asistente IA del Hub con historial persistente
// (tipo ChatGPT) + forja de imágenes HD gratis (FLUX).
//  · Sidebar de conversaciones (fija en escritorio, Sheet en móvil)
//    con renombrar / eliminar y contador de uso del día.
//  · El mensaje sale AL INSTANTE (eco optimista) y la respuesta
//    llega EN VIVO, palabra por palabra (streaming NDJSON).
//  · Toggle "Internet": busca en la web antes de responder y
//    muestra las fuentes usadas.
//  · "Modo imagen": describe la escena y el Oráculo la forja en
//    HD (descargable, con botón "Variar" para nueva seed).
// ============================================================

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Sparkles,
  Send,
  Globe,
  ExternalLink,
  AlertTriangle,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  PanelLeftOpen,
  Download,
  RefreshCw,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Image as ImageIcon,
  Loader2,
  type LucideIcon,
} from "lucide-react"
import Markdown from "react-markdown"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { UserAvatar } from "@/components/alqemia/avatar"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"
import { useMe } from "@/hooks/use-me"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { ChatMsg, ConversationSummary } from "@/lib/types"

type Phase = "idle" | "sending" | "searching" | "streaming" | "forging"
type Source = { title: string; url: string }
type ImageSizeKey = "square" | "landscape" | "portrait"

type StreamEvent =
  | { t: "conv"; id: string; title: string }
  | { t: "user"; msg: ChatMsg }
  | { t: "searching" }
  | { t: "sources"; results: Source[] }
  | { t: "delta"; v: string }
  | { t: "done"; msg: ChatMsg }
  | { t: "error"; error: string }

type ConversationsResponse = {
  conversations: ConversationSummary[]
  usage: { messages: number; images: number }
}

const SUGGESTIONS: { label: string; image?: boolean }[] = [
  { label: "Copy para mi producto" },
  { label: "Analiza mi embudo" },
  { label: "Crea una imagen para mi anuncio", image: true },
  { label: "Plan de contenido 7 días" },
]

const SIZE_OPTIONS: { key: ImageSizeKey; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "square", label: "Cuadrada", hint: "1024 × 1024", icon: Square },
  { key: "landscape", label: "Horizontal", hint: "1344 × 768", icon: RectangleHorizontal },
  { key: "portrait", label: "Vertical", hint: "768 × 1344", icon: RectangleVertical },
]

const ASPECT: Record<ImageSizeKey, string> = {
  square: "aspect-square max-w-[15rem]",
  landscape: "aspect-[7/4] max-w-[24rem]",
  portrait: "aspect-[4/7] max-w-[15rem]",
}

/** Mensaje temporal (eco optimista / stream cortado) con la forma del DTO. */
function tmpMsg(partial: {
  id: string
  role: "user" | "assistant"
  content: string
  conversationId: string | null
}): ChatMsg {
  return {
    ...partial,
    createdAt: new Date().toISOString(),
    kind: "text",
    imagePrompt: null,
    imageSize: null,
    imageData: null,
  }
}

/** "1024x1024" → "square" · "1344x768" → "landscape" · "768x1344" → "portrait" */
function sizeFromImageSize(s: string | null): ImageSizeKey {
  if (s === "1344x768") return "landscape"
  if (s === "768x1344") return "portrait"
  return "square"
}

// ============================================================
// Burbujas
// ============================================================

function OracleAvatar({ live = false }: { live?: boolean }) {
  return (
    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
      <Sparkles
        className={cn("h-3.5 w-3.5 text-gold-bright", live && "animate-pulse")}
        aria-hidden
      />
    </span>
  )
}

function MessageBubble({
  msg,
  name,
  image,
  avatarColor,
}: {
  msg: ChatMsg
  name: string
  image: string | null
  avatarColor: string | null
}) {
  const isUser = msg.role === "user"
  return (
    <div className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <OracleAvatar />}
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

/** Mensaje de IMAGEN generada: burbuja ancha + descarga + variar. */
function ImageMessage({
  msg,
  busy,
  onDownload,
  onVary,
}: {
  msg: ChatMsg
  busy: boolean
  onDownload: (m: ChatMsg) => void
  onVary: (m: ChatMsg) => void
}) {
  const prompt = msg.imagePrompt ?? msg.content
  return (
    <div className="flex w-full gap-2.5">
      <OracleAvatar />
      <figure className="w-full max-w-[min(85%,26rem)] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-950/80 p-2 sm:max-w-[min(75%,28rem)]">
        {msg.imageData ? (
          <img
            src={msg.imageData}
            alt={prompt}
            className="w-full rounded-xl"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-zinc-900 text-xs text-zinc-600">
            Imagen no disponible
          </div>
        )}
        <figcaption className="mt-1.5 line-clamp-2 px-1 text-xs text-zinc-500">{prompt}</figcaption>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 pb-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 border-zinc-800 px-2.5 text-[11px] text-zinc-400 hover:border-gold/40 hover:text-gold-bright"
            onClick={() => onDownload(msg)}
          >
            <Download className="h-3 w-3" aria-hidden />
            Descargar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 border-zinc-800 px-2.5 text-[11px] text-zinc-400 hover:border-gold/40 hover:text-gold-bright"
            onClick={() => onVary(msg)}
            disabled={busy}
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Variar
          </Button>
        </div>
      </figure>
    </div>
  )
}

/** Burbuja en vivo: el texto del stream + cursor titilante + fuentes web. */
function StreamingBubble({ text, sources }: { text: string; sources: Source[] }) {
  return (
    <div className="flex w-full gap-2.5">
      <OracleAvatar live />
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

/** Placeholder con shimmer mientras se forja la imagen. */
function ForgingBubble({ size }: { size: ImageSizeKey }) {
  return (
    <div className="flex w-full gap-2.5">
      <OracleAvatar live />
      <div
        className={cn(
          "w-full max-w-[min(85%,26rem)] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-950/80 p-2 sm:max-w-[min(75%,28rem)]",
          ASPECT[size]
        )}
        aria-hidden
      >
        <div className="h-full w-full animate-pulse rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-800/70 to-zinc-900" />
      </div>
      <span className="sr-only" role="status">
        Forjando imagen…
      </span>
    </div>
  )
}

// ============================================================
// Sidebar de conversaciones (escritorio + Sheet móvil)
// ============================================================

type SidebarProps = {
  conversations: ConversationSummary[]
  activeId: string | null
  loading: boolean
  usage: { messages: number; images: number } | null
  busy: boolean
  renamingId: string | null
  renameValue: string
  onRenameValue: (v: string) => void
  onRenameStart: (c: ConversationSummary) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (c: ConversationSummary) => void
}

function ConversationItem({
  conv,
  active,
  busy,
  renaming,
  renameValue,
  onRenameValue,
  onRenameCommit,
  onRenameCancel,
  onRenameStart,
  onSelect,
  onDelete,
}: {
  conv: ConversationSummary
  active: boolean
  busy: boolean
  renaming: boolean
  renameValue: string
  onRenameValue: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onRenameStart: (c: ConversationSummary) => void
  onSelect: (id: string) => void
  onDelete: (c: ConversationSummary) => void
}) {
  if (renaming) {
    return (
      <div className="px-1 py-0.5">
        <Input
          autoFocus
          value={renameValue}
          maxLength={60}
          onChange={(e) => onRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onRenameCommit()
            } else if (e.key === "Escape") {
              e.preventDefault()
              onRenameCancel()
            }
          }}
          onBlur={onRenameCancel}
          aria-label="Nuevo título de la conversación"
          className="h-9 rounded-lg border-gold/40 bg-zinc-950 text-xs text-zinc-100 focus-visible:ring-gold/30"
        />
        <p className="mt-1 px-1 text-[9px] text-zinc-600">Enter para guardar · Esc para cancelar</p>
      </div>
    )
  }
  return (
    <div
      className={cn(
        "group relative flex items-center gap-0.5 rounded-lg transition-colors",
        active ? "bg-gold/10 ring-1 ring-gold/30" : "hover:bg-zinc-900/70"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        aria-current={active ? "true" : undefined}
        className="min-w-0 flex-1 truncate px-2.5 py-2.5 text-left text-xs font-medium text-zinc-300 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 rounded-l-lg"
        title={conv.title}
      >
        <span className="block truncate">{conv.title}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Opciones de la conversación ${conv.title}`}
            className="h-7 w-7 shrink-0 rounded-md text-zinc-500 opacity-60 transition-opacity hover:text-zinc-200 focus-visible:opacity-100 focus-visible:ring-gold/40 group-hover:opacity-100 lg:opacity-0 lg:data-[state=open]:opacity-100"
          >
            <MoreVertical className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 border-zinc-800">
          <DropdownMenuItem onSelect={() => onRenameStart(conv)} className="gap-2 text-xs">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onDelete(conv)}
            className="gap-2 text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function OracleSidebar(props: SidebarProps) {
  const {
    conversations,
    activeId,
    loading,
    usage,
    busy,
    renamingId,
    renameValue,
    onRenameValue,
    onRenameStart,
    onRenameCommit,
    onRenameCancel,
    onSelect,
    onNew,
    onDelete,
  } = props
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3 pb-2">
        <button
          type="button"
          onClick={onNew}
          disabled={busy}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 text-xs font-semibold text-gold-bright transition-all hover:border-gold/60 hover:bg-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva conversación
        </button>
      </div>
      <nav
        aria-label="Conversaciones guardadas"
        className="thin-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3"
      >
        {loading ? (
          <div className="space-y-2 p-1" aria-hidden>
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-5/6 rounded-lg" />
            <Skeleton className="h-9 w-4/6 rounded-lg" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 pt-6 text-center text-[11px] leading-relaxed text-zinc-600">
            Aún no hay conversaciones.
            <br />
            Pregúntale algo al Oráculo para empezar.
          </p>
        ) : (
          conversations.map((c) => (
            <ConversationItem
              key={c.id}
              conv={c}
              active={c.id === activeId}
              busy={busy}
              renaming={c.id === renamingId}
              renameValue={renameValue}
              onRenameValue={onRenameValue}
              onRenameStart={onRenameStart}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        )}
      </nav>
      {usage && (
        <p className="border-t border-zinc-800/80 px-4 py-2.5 text-[10px] leading-relaxed text-zinc-600">
          Hoy: {usage.images}/20 imágenes · {usage.messages}/60 mensajes
        </p>
      )}
    </div>
  )
}

// ============================================================
// Vista principal
// ============================================================

export function AiChatView() {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const user = me?.user

  const activeId = useAppStore((s) => s.oracleConversationId)
  const setOracleConversationId = useAppStore((s) => s.setOracleConversationId)

  const [input, setInput] = useState("")
  const [web, setWeb] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [sizeKey, setSizeKey] = useState<ImageSizeKey>("square")
  const [phase, setPhase] = useState<Phase>("idle")
  const [optimistic, setOptimistic] = useState<ChatMsg | null>(null)
  const [streamText, setStreamText] = useState("")
  const [sources, setSources] = useState<Source[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const busy = phase !== "idle"

  // ---- Persistencia de la conversación activa (localStorage por usuario) ----
  const lsKey = user ? `alqemia:oracle-conv:${user.id}` : null

  const setActive = useCallback(
    (id: string | null) => {
      setOracleConversationId(id)
      if (!lsKey) return
      try {
        if (id) localStorage.setItem(lsKey, id)
        else localStorage.removeItem(lsKey)
      } catch {
        // localStorage bloqueado: solo vive en memoria
      }
    },
    [lsKey, setOracleConversationId]
  )

  useEffect(() => {
    if (!lsKey) return
    try {
      const saved = localStorage.getItem(lsKey)
      if (saved && useAppStore.getState().oracleConversationId === null) {
        setOracleConversationId(saved)
      }
    } catch {
      // localStorage bloqueado
    }
  }, [lsKey, setOracleConversationId])

  // ---- Queries: lista de conversaciones + mensajes de la activa ----
  const convQuery = useQuery<ConversationsResponse>({
    queryKey: ["oracle", "conversations"],
    queryFn: async () => {
      const res = await fetch("/api/ai/chat")
      if (!res.ok) throw new Error("No se pudo cargar tus conversaciones")
      return res.json()
    },
    staleTime: 15_000,
  })
  const conversations = convQuery.data?.conversations ?? []
  const usage = convQuery.data?.usage ?? null

  const msgsQuery = useQuery<{ messages: ChatMsg[] }>({
    queryKey: ["oracle", "messages", activeId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/chat?conversationId=${encodeURIComponent(activeId as string)}`)
      if (res.status === 404) {
        const err = new Error("La conversación ya no existe") as Error & { status?: number }
        err.status = 404
        throw err
      }
      if (!res.ok) throw new Error("No se pudo cargar la conversación")
      return res.json()
    },
    enabled: !!activeId,
    staleTime: 30_000,
  })
  const messages = activeId ? (msgsQuery.data?.messages ?? []) : []
  const loadingMessages = !!activeId && msgsQuery.isLoading

  // La conversación activa fue borrada / no es de este usuario → hilo nuevo
  useEffect(() => {
    const err = msgsQuery.error as (Error & { status?: number }) | null
    if (err && err.status === 404) {
      setActive(null)
    }
  }, [msgsQuery.error, setActive])

  /** Añade mensajes confirmados por el servidor a la caché (dedupe por id). */
  const appendToConv = useCallback(
    (convId: string | null, msgs: ChatMsg[]) => {
      if (!convId) return
      queryClient.setQueryData<{ messages: ChatMsg[] }>(["oracle", "messages", convId], (old) => {
        const base = old?.messages ?? []
        const ids = new Set(base.map((m) => m.id))
        const next = [...base]
        for (const m of msgs) {
          if (!ids.has(m.id)) {
            next.push(m)
            ids.add(m.id)
          }
        }
        return { messages: next }
      })
    },
    [queryClient]
  )

  // Auto-scroll al último mensaje / al texto que crece
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, activeId, streamText, phase, optimistic, streamError])

  // ============================================================
  // Envío de TEXTO (streaming NDJSON)
  // ============================================================
  async function sendText(text: string) {
    if (busy) return
    const now = new Date().toISOString()
    const convIdAtSend = activeId
    setOptimistic(tmpMsg({ id: `tmp-${now}`, role: "user", content: text, conversationId: convIdAtSend }))
    setPhase("sending")
    setStreamText("")
    setSources([])
    setStreamError(null)

    let convId = convIdAtSend
    let userConfirmed: ChatMsg | null = null
    let doneMsg: ChatMsg | null = null
    let streamErr: string | null = null
    let acc = ""

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, web, conversationId: convIdAtSend }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "El Oráculo no pudo responder")
      }
      if (!res.body) throw new Error("El Oráculo no pudo responder")

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
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
          if (ev.t === "conv") {
            // La conversación se registró en el servidor → refrescar lista
            convId = ev.id
            void queryClient.invalidateQueries({ queryKey: ["oracle", "conversations"] })
          } else if (ev.t === "user") {
            userConfirmed = ev.msg
            if (convIdAtSend) {
              // hilo existente: reconciliar al instante el eco optimista
              setOptimistic(null)
              appendToConv(convIdAtSend, [ev.msg])
            }
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
        const finalConv = convId
        const confirmed = userConfirmed ? [userConfirmed, doneMsg] : [doneMsg]
        appendToConv(finalConv, confirmed)
        if (!convIdAtSend && finalConv) setActive(finalConv)
        void queryClient.invalidateQueries({ queryKey: ["oracle", "conversations"] })
      } else if (streamErr) {
        // El mensaje del usuario quedó guardado; el error se muestra inline
        if (userConfirmed && !convIdAtSend && convId) appendToConv(convId, [userConfirmed])
        if (!convIdAtSend && convId) setActive(convId)
        setStreamError(streamErr)
        toast.error(streamErr)
      } else if (acc) {
        // Stream cortado sin done: se muestra lo recibido como final
        const finalConv = convId
        const confirmed = userConfirmed && !convIdAtSend ? [userConfirmed] : []
        appendToConv(finalConv, [
          ...confirmed,
          tmpMsg({ id: `tmp-a-${Date.now()}`, role: "assistant", content: acc, conversationId: finalConv }),
        ])
        if (!convIdAtSend && finalConv) setActive(finalConv)
        void queryClient.invalidateQueries({ queryKey: ["oracle", "conversations"] })
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

  // ============================================================
  // Envío de IMAGEN (forja HD con FLUX vía /api/ai/image)
  // ============================================================
  async function sendImage(prompt: string, size: ImageSizeKey = sizeKey) {
    if (busy) return
    const convIdAtSend = activeId
    setOptimistic(tmpMsg({ id: `tmp-i-${Date.now()}`, role: "user", content: prompt, conversationId: convIdAtSend }))
    setPhase("forging")
    setStreamError(null)

    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size, conversationId: convIdAtSend }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        conversationId?: string
        userMsg?: ChatMsg
        msg?: ChatMsg
        error?: string
      }
      if (!res.ok) throw new Error(j.error ?? "El forjador de imágenes no respondió")

      const convId = j.conversationId ?? convIdAtSend
      const confirmed: ChatMsg[] = []
      if (j.userMsg) confirmed.push(j.userMsg)
      if (j.msg) confirmed.push(j.msg)
      appendToConv(convId, confirmed)
      if (!convIdAtSend && convId) setActive(convId)
      void queryClient.invalidateQueries({ queryKey: ["oracle", "conversations"] })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo forjar la imagen"
      setStreamError(msg)
      toast.error(msg)
    } finally {
      setOptimistic(null)
      setPhase("idle")
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput("")
    if (imageMode) {
      await sendImage(text)
    } else {
      await sendText(text)
    }
    textareaRef.current?.focus()
  }

  // ============================================================
  // Acciones de conversaciones (seleccionar / nueva / renombrar / borrar)
  // ============================================================
  const selectConversation = useCallback(
    (id: string) => {
      if (busy) return
      setActive(id)
      setStreamError(null)
      setRenamingId(null)
      setSheetOpen(false)
    },
    [busy, setActive]
  )

  const startNewConversation = useCallback(() => {
    if (busy) return
    setActive(null)
    setStreamError(null)
    setRenamingId(null)
    setSheetOpen(false)
    setInput("")
    textareaRef.current?.focus()
  }, [busy, setActive])

  const startRename = useCallback((c: ConversationSummary) => {
    setRenamingId(c.id)
    setRenameValue(c.title)
  }, [])

  const cancelRename = useCallback(() => setRenamingId(null), [])

  const commitRename = useCallback(async () => {
    const id = renamingId
    const title = renameValue.trim()
    setRenamingId(null)
    if (!id || !title) return
    if (conversations.find((c) => c.id === id)?.title === title) return
    try {
      const res = await fetch("/api/ai/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, title }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo renombrar")
      }
      toast.success("Conversación renombrada")
      void queryClient.invalidateQueries({ queryKey: ["oracle", "conversations"] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo renombrar la conversación")
    }
  }, [conversations, queryClient, renameValue, renamingId])

  const requestDelete = useCallback((c: ConversationSummary) => setDeleteTarget(c), [])

  async function confirmDelete() {
    const target = deleteTarget
    setDeleteTarget(null)
    if (!target) return
    try {
      const res = await fetch(`/api/ai/chat?conversationId=${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo eliminar")
      }
      toast.success("Conversación eliminada")
      if (activeId === target.id) setActive(null)
      queryClient.removeQueries({ queryKey: ["oracle", "messages", target.id] })
      void queryClient.invalidateQueries({ queryKey: ["oracle", "conversations"] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar la conversación")
    }
  }

  // ============================================================
  // Utilidades de UI
  // ============================================================
  async function downloadImage(msg: ChatMsg) {
    if (!msg.imageData) return
    try {
      const res = await fetch(msg.imageData)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `alqemia-${msg.id}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("No se pudo descargar la imagen")
    }
  }

  function varyImage(msg: ChatMsg) {
    void sendImage(msg.imagePrompt ?? msg.content, sizeFromImageSize(msg.imageSize))
  }

  function quickAsk(s: { label: string; image?: boolean }) {
    if (busy) return
    if (s.image) {
      setImageMode(true)
      setInput("")
    } else {
      setInput(s.label)
    }
    textareaRef.current?.focus()
  }

  const status =
    phase === "searching"
      ? "Buscando en internet…"
      : phase === "streaming"
        ? "Escribiendo…"
        : phase === "forging"
          ? "Forjando imagen…"
          : phase === "sending"
            ? "Pensando…"
            : "Tu consejero de marketing · con memoria e imágenes"

  const showWelcome = messages.length === 0 && phase === "idle" && !optimistic && !loadingMessages

  const sidebarProps: SidebarProps = {
    conversations,
    activeId,
    loading: convQuery.isLoading,
    usage,
    busy,
    renamingId,
    renameValue,
    onRenameValue: setRenameValue,
    onRenameStart: startRename,
    onRenameCommit: () => void commitRename(),
    onRenameCancel: cancelRename,
    onSelect: selectConversation,
    onNew: startNewConversation,
    onDelete: requestDelete,
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-6xl flex-col lg:h-[calc(100dvh-6rem)] lg:flex-row lg:gap-4">
      {/* ===== Sidebar escritorio ===== */}
      <aside className="hidden w-64 shrink-0 lg:block" aria-label="Conversaciones del Oráculo">
        <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-950/60">
          <OracleSidebar {...sidebarProps} />
        </div>
      </aside>

      {/* ===== Hilo principal ===== */}
      <Card className="gate-card min-h-0 min-w-0 flex-1 gap-0 overflow-hidden rounded-2xl p-0">
        {/* Header */}
        <header className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2.5 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSheetOpen(true)}
            aria-label="Abrir lista de conversaciones"
            className="h-9 w-9 shrink-0 rounded-lg text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 lg:hidden"
          >
            <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden />
          </Button>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/40">
            <Sparkles className="h-5 w-5 text-gold-bright" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-none">
              <AlqemiaLetters text="El Oráculo" strokeWidth={9} />
            </h1>
            <p className="mt-1 truncate text-xs text-zinc-500">{status}</p>
          </div>
        </header>

        {/* Mensajes */}
        <div
          className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
          role="log"
          aria-label="Conversación con El Oráculo"
          aria-live="polite"
        >
          {loadingMessages ? (
            <div className="space-y-4" aria-hidden>
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
            </div>
          ) : showWelcome ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-4 py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 shadow-[0_0_40px_-8px_rgba(212,175,55,0.6)] ring-1 ring-gold/40">
                <Sparkles className="h-8 w-8 text-gold-bright" aria-hidden />
              </span>
              <div>
                <h2 className="leading-tight">
                  <span className="block text-lg sm:text-xl">
                    <AlqemiaLetters text="Pregúntale lo que sea" strokeWidth={9} />
                  </span>
                  <span className="mt-2.5 block text-2xl sm:text-3xl">
                    <AlqemiaLetters text="al Oráculo" strokeWidth={8} />
                  </span>
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm text-zinc-500">
                  Copys, embudos, estrategias e imágenes HD. Cada conversación queda guardada con
                  toda su historia.
                </p>
              </div>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => quickAsk(s)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-800 px-3.5 py-1.5 text-xs text-zinc-400 transition-all hover:border-gold/40 hover:text-gold-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                  >
                    {s.image && <ImageIcon className="h-3 w-3" aria-hidden />}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) =>
                m.role === "assistant" && m.kind === "image" ? (
                  <ImageMessage
                    key={m.id}
                    msg={m}
                    busy={busy}
                    onDownload={(msg) => void downloadImage(msg)}
                    onVary={varyImage}
                  />
                ) : (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    name={user?.name ?? "Tú"}
                    image={user?.image ?? null}
                    avatarColor={user?.avatarColor ?? null}
                  />
                )
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

              {/* Estado en vivo del Oráculo (texto) */}
              {(phase === "sending" || phase === "searching") && streamText === "" && (
                <div className="flex gap-2.5">
                  <OracleAvatar live />
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

              {/* Forja de imagen: shimmer + estado */}
              {phase === "forging" && (
                <div className="space-y-2">
                  <ForgingBubble size={sizeKey} />
                  <p className="flex items-center gap-2 pl-10 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden />
                    Forjando imagen en HD…
                  </p>
                </div>
              )}

              {/* Error inline (el hilo no se rompe) */}
              {streamError && (
                <div className="flex justify-center">
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {streamError}
                  </p>
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Entrada */}
        <form onSubmit={handleSubmit} className="border-t border-zinc-800/80 p-3 sm:p-4">
          {imageMode && (
            <div className="mb-2 flex items-center gap-1" role="group" aria-label="Tamaño de la imagen">
              <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Tamaño
              </span>
              {SIZE_OPTIONS.map((opt) => {
                const active = sizeKey === opt.key
                const Icon = opt.icon
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSizeKey(opt.key)}
                    aria-pressed={active}
                    aria-label={`${opt.label} (${opt.hint})`}
                    title={`${opt.label} · ${opt.hint}`}
                    className={cn(
                      "flex h-9 w-10 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                      active
                        ? "border-gold/50 bg-gold/15 text-gold-bright shadow-[0_0_14px_-4px_rgba(212,175,55,0.5)]"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex items-end gap-1.5 sm:gap-2">
            {/* Toggle Internet */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeb((w) => !w)}
              disabled={imageMode}
              aria-pressed={web}
              title={
                imageMode
                  ? "La búsqueda web no aplica al modo imagen"
                  : web
                    ? "Internet activado: buscará en la web antes de responder"
                    : "Activar búsqueda en internet"
              }
              className={cn(
                "h-11 w-11 shrink-0 border-zinc-800 p-0 transition-all",
                web
                  ? "border-gold/50 bg-gold/15 text-gold-bright shadow-[0_0_14px_-4px_rgba(212,175,55,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300",
                imageMode && "opacity-40"
              )}
            >
              <Globe className={cn("h-4 w-4", web && "text-gold")} aria-hidden />
              <span className="sr-only">Búsqueda en internet</span>
            </Button>
            {/* Toggle Modo imagen */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setImageMode((v) => !v)}
              aria-pressed={imageMode}
              title={
                imageMode
                  ? "Modo imagen activado: describe la escena y se forjará una imagen HD"
                  : "Activar modo imagen (forja imágenes HD)"
              }
              className={cn(
                "h-11 w-11 shrink-0 border-zinc-800 p-0 transition-all",
                imageMode
                  ? "border-gold/50 bg-gold/15 text-gold-bright shadow-[0_0_14px_-4px_rgba(212,175,55,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <ImageIcon className={cn("h-4 w-4", imageMode && "text-gold")} aria-hidden />
              <span className="sr-only">Modo imagen</span>
            </Button>
            <Textarea
              ref={textareaRef}
              rows={1}
              maxLength={imageMode ? 1000 : 8000}
              placeholder={
                imageMode ? "Describe la imagen que quieres forjar…" : "Pregúntale algo a El Oráculo…"
              }
              className="max-h-32 min-h-11 resize-none border-zinc-800 bg-zinc-950/70 py-2.5 focus-visible:border-gold/50 focus-visible:ring-gold/25"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit(e)
                }
              }}
              aria-label={
                imageMode ? "Descripción de la imagen a forjar" : "Mensaje para El Oráculo"
              }
            />
            <Button
              type="submit"
              disabled={busy || input.trim().length === 0}
              aria-label={imageMode ? "Forjar imagen" : "Enviar mensaje"}
              className={cn(
                "h-11 w-11 shrink-0 p-0",
                imageMode
                  ? "btn-gold font-semibold"
                  : "border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              )}
            >
              <Send aria-hidden />
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-zinc-600">
            {imageMode
              ? "Describe la escena · Enter para forjar · Shift+Enter para salto de línea"
              : "Enter para enviar · Shift+Enter para salto de línea"}
            {web && !imageMode && (
              <span className="text-gold/80"> · Internet activado: responderá con fuentes de la web</span>
            )}
          </p>
        </form>
      </Card>

      {/* ===== Sidebar móvil (Sheet) ===== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-[17.5rem] gap-0 border-zinc-800 bg-zinc-950/95 p-0 sm:max-w-none"
        >
          <SheetHeader className="border-b border-zinc-800/80 px-4 py-3">
            <SheetTitle className="text-left text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              El Oráculo · Conversaciones
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <OracleSidebar {...sidebarProps} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== Confirmación de borrado ===== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará «{deleteTarget?.title}» con todos sus mensajes e imágenes. Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

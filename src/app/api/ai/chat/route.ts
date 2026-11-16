// /api/ai/chat — El Oráculo: conversaciones persistentes (tipo ChatGPT)
// GET    (sin query)         → { conversations, usage } del usuario (updatedAt desc, 50)
//                              MIGRACIÓN PEREZOSA: los mensajes viejos sin conversación
//                              se agrupan en "Archivo del Oráculo" para no perderlos.
// GET    ?conversationId=x   → { messages } de esa conversación (asc, 200) · 404 si no es suya
// POST   { message, web?, conversationId? } → stream NDJSON. Eventos:
//   {"t":"conv","id":"...","title":"..."} → conversación (nueva o existente) para sincronizar
//   {"t":"user","msg":{...}}              → el mensaje del usuario ya guardado (reconciliar)
//   {"t":"searching"}                      → buscando en internet (si web=true)
//   {"t":"sources","results":[...]}        → resultados de la búsqueda (fuentes)
//   {"t":"delta","v":"..."}                → trozo de respuesta del modelo (tiempo real)
//   {"t":"done","msg":{...}}               → respuesta final guardada en la BD
//   {"t":"error","error":"..."}            → fallo del modelo
// PATCH  { conversationId, title } → renombra la conversación (1..60)
// DELETE ?conversationId=x → borra la conversación (cascade → mensajes)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError } from "@/lib/api-helpers"
import { ORACLE_SYSTEM_PROMPT, oracleStreamWith, webSearch, type WebResult } from "@/lib/ai"
import type { ChatMsg, ConversationSummary } from "@/lib/types"

const MAX_HISTORY = 16 // mensajes enviados al modelo como contexto
const MAX_CONTENT = 8000
const DAILY_LIMIT = 60 // anti-abuso razonable
const ARCHIVE_TITLE = "Archivo del Oráculo"

type ChatMessage = { role: "user" | "assistant"; content: string }

type MsgRow = {
  id: string
  role: string
  content: string
  createdAt: Date
  conversationId: string | null
  kind: string
  imagePrompt: string | null
  imageSize: string | null
  imageData: string | null
}

function toDTO(m: MsgRow): ChatMsg {
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    conversationId: m.conversationId,
    kind: m.kind === "image" ? "image" : "text",
    imagePrompt: m.imagePrompt,
    imageSize: m.imageSize,
    imageData: m.imageData,
  }
}

function toSummary(c: { id: string; title: string; createdAt: Date; updatedAt: Date }): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

/** Título de conversación nueva: primeras ~42 letras del mensaje
 *  recortadas a palabra completa (sin cortar palabras a la mitad). */
function buildTitle(text: string, max = 42): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > 16 ? cut.slice(0, lastSpace) : cut).trim() || cut
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const conversationId = req.nextUrl.searchParams.get("conversationId")

    // ---- Mensajes de UNA conversación ----
    if (conversationId) {
      const conv = await db.conversation.findFirst({ where: { id: conversationId, userId: me.id } })
      if (!conv) throw new ApiError(404, "La conversación no existe")
      const messages = await db.chatMessage.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "asc" },
        take: 200,
      })
      return Response.json({ messages: messages.map(toDTO) })
    }

    // ---- Lista de conversaciones ----
    // Migración perezosa: el historial del hilo único viejo (mensajes sin
    // conversación) pasa a una conversación "Archivo del Oráculo".
    const orphans = await db.chatMessage.count({
      where: { userId: me.id, conversationId: null },
    })
    if (orphans > 0) {
      const last = await db.chatMessage.findFirst({
        where: { userId: me.id, conversationId: null },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
      const archive = await db.conversation.create({
        data: { userId: me.id, title: ARCHIVE_TITLE, updatedAt: last?.createdAt ?? new Date() },
      })
      await db.chatMessage.updateMany({
        where: { userId: me.id, conversationId: null },
        data: { conversationId: archive.id },
      })
    }

    const conversations = await db.conversation.findMany({
      where: { userId: me.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })

    // Uso de hoy (para el contador discreto del sidebar)
    const dayAgo = new Date(Date.now() - 24 * 3600_000)
    const [messages24h, images24h] = await Promise.all([
      db.chatMessage.count({ where: { userId: me.id, role: "user", createdAt: { gte: dayAgo } } }),
      db.chatMessage.count({ where: { userId: me.id, kind: "image", createdAt: { gte: dayAgo } } }),
    ])

    return Response.json({
      conversations: conversations.map(toSummary),
      usage: { messages: messages24h, images: images24h },
    })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest) {
  // ---- Validación y guardado ANTES de abrir el stream (cookies + BD) ----
  let me: Awaited<ReturnType<typeof requireActiveUser>>
  let message: string
  let useWeb = false
  let reqConversationId: string | null = null
  try {
    me = await requireActiveUser()
    const body = (await req.json().catch(() => ({}))) as {
      message?: unknown
      web?: unknown
      conversationId?: unknown
    }
    message = String(body.message ?? "").trim()
    useWeb = body.web === true
    if (typeof body.conversationId === "string" && body.conversationId.trim()) {
      reqConversationId = body.conversationId.trim()
    }
    if (!message) throw new ApiError(400, "Escribe tu pregunta")
    if (message.length > MAX_CONTENT) throw new ApiError(400, "El mensaje es demasiado largo (máx. 8000 caracteres)")

    // Anti-abuso: límite de mensajes por día
    const dayAgo = new Date(Date.now() - 24 * 3600_000)
    const sentToday = await db.chatMessage.count({
      where: { userId: me.id, role: "user", createdAt: { gte: dayAgo } },
    })
    if (sentToday >= DAILY_LIMIT) {
      throw new ApiError(429, "Llegaste al límite diario de mensajes (60/día). Vuelve mañana.")
    }
  } catch (e) {
    return handleApiError(e)
  }

  // ---- Conversación: verificar dueño o crear una nueva ----
  let conversation: { id: string; title: string }
  if (reqConversationId) {
    const existing = await db.conversation.findFirst({
      where: { id: reqConversationId, userId: me.id },
    })
    if (!existing) return handleApiError(new ApiError(404, "La conversación no existe"))
    conversation = { id: existing.id, title: existing.title }
  } else {
    const created = await db.conversation.create({
      data: { userId: me.id, title: buildTitle(message) },
    })
    conversation = { id: created.id, title: created.title }
  }
  const convId = conversation.id

  // Historial reciente de ESA conversación como contexto (sin el mensaje nuevo)
  const historyRows = await db.chatMessage
    .findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY,
      select: { role: true, content: true, kind: true },
    })
    .catch(() => [])
  historyRows.reverse()
  const history: ChatMessage[] = historyRows.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.kind === "image" ? `[Se generó una imagen para este pedido: ${m.content}]` : m.content,
  }))

  // Guardar el mensaje del usuario ANTES de llamar al modelo
  const savedUser = await db.chatMessage.create({
    data: { userId: me.id, conversationId: convId, role: "user", content: message },
  })
  await db.conversation
    .update({ where: { id: convId }, data: { updatedAt: new Date() } })
    .catch(() => {})

  // System prompt con fecha de hoy (el modelo sabe "cuándo es hoy")
  const today = new Date().toLocaleDateString("es-419", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  let systemPrompt = `${ORACLE_SYSTEM_PROMPT}\n\nFecha de hoy: ${today}. Tenla en cuenta para plazos, tendencias y eventos.`

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (obj: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
        } catch {
          closed = true
        }
      }

      // Primer evento: la conversación (nueva o existente) para que el cliente sincronice
      send({ t: "conv", id: conversation.id, title: conversation.title })
      send({ t: "user", msg: toDTO(savedUser) })

      try {
        // ---- Búsqueda en internet (opcional) ----
        let sources: WebResult[] = []
        if (useWeb) {
          send({ t: "searching" })
          try {
            sources = await webSearch(message)
          } catch {
            sources = []
          }
          if (sources.length > 0) {
            send({
              t: "sources",
              results: sources.map((r) => ({ title: r.title, url: r.url })),
            })
            const context = sources
              .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nResumen: ${r.snippet}`)
              .join("\n\n")
            systemPrompt += `

RESULTADOS DE BÚSQUEDA EN INTERNET RECIENTES (sobre lo que preguntó el usuario):
${context}

Cuando uses esta información: cita las fuentes como enlaces markdown [texto](url) al final de tu respuesta en una sección "Fuentes", y prioriza datos concretos (fechas, cifras, novedades). Si los resultados no aportan nada útil, responde con tu conocimiento y dilo con honestidad.`
          }
        }

        // ---- Streaming del modelo ----
        const modelMessages: ChatMessage[] = [
          ...history,
          { role: "user" as const, content: message },
        ]

        let acc = ""
        for await (const delta of oracleStreamWith(systemPrompt, modelMessages)) {
          acc += delta
          send({ t: "delta", v: delta })
        }

        if (!acc.trim()) throw new Error("respuesta vacía del modelo")

        const saved = await db.chatMessage.create({
          data: {
            userId: me.id,
            conversationId: convId,
            role: "assistant",
            content: acc.slice(0, MAX_CONTENT),
          },
        })
        await db.conversation
          .update({ where: { id: convId }, data: { updatedAt: new Date() } })
          .catch(() => {})
        send({ t: "done", msg: toDTO(saved) })
      } catch (err) {
        console.error("[api/ai/chat] Error del modelo:", err)
        send({ t: "error", error: "El Oráculo no pudo responder. Intenta de nuevo en unos segundos." })
      } finally {
        if (!closed) {
          try {
            controller.close()
          } catch {
            // el cliente ya se fue
          }
        }
        closed = true
      }
    },
    cancel() {
      // El cliente cerró: la generación sigue en el fondo (start ya la ejecuta)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const body = (await req.json().catch(() => ({}))) as { conversationId?: unknown; title?: unknown }
    const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : ""
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!conversationId) throw new ApiError(400, "Falta el id de la conversación")
    if (!title || title.length > 60) {
      throw new ApiError(400, "El título debe tener entre 1 y 60 caracteres")
    }
    const conv = await db.conversation.findFirst({ where: { id: conversationId, userId: me.id } })
    if (!conv) throw new ApiError(404, "La conversación no existe")
    const updated = await db.conversation.update({ where: { id: conv.id }, data: { title } })
    return Response.json({ conversation: toSummary(updated) })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const conversationId = req.nextUrl.searchParams.get("conversationId")
    if (!conversationId) throw new ApiError(400, "Falta el id de la conversación")
    const conv = await db.conversation.findFirst({ where: { id: conversationId, userId: me.id } })
    if (!conv) throw new ApiError(404, "La conversación no existe")
    // onDelete: Cascade → borra también sus mensajes
    await db.conversation.delete({ where: { id: conv.id } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

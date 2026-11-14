// /api/ai/chat — El Oráculo: asistente IA del Hub
// GET: historial · POST: mensaje en STREAMING (NDJSON, delta por línea) · DELETE: nueva conversación
// El stream emite eventos:
//   {"t":"user","msg":{...}}      → el mensaje del usuario ya guardado (reconciliar)
//   {"t":"searching"}             → buscando en internet (si web=true)
//   {"t":"sources","results":[...]} → resultados de la búsqueda (para mostrar fuentes)
//   {"t":"delta","v":"..."}       → trozo de respuesta del modelo (en tiempo real)
//   {"t":"done","msg":{...}}      → respuesta final guardada en la BD
//   {"t":"error","error":"..."}   → fallo del modelo
// El modelo se resuelve en @/lib/ai (Workers AI en producción · SDK local en dev).
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError } from "@/lib/api-helpers"
import { ORACLE_SYSTEM_PROMPT, oracleStreamWith, webSearch, type WebResult } from "@/lib/ai"
import type { ChatMsg } from "@/lib/types"

const MAX_HISTORY = 16 // mensajes enviados al modelo como contexto
const MAX_CONTENT = 8000
const DAILY_LIMIT = 60 // anti-abuso razonable

type ChatMessage = { role: "user" | "assistant"; content: string }

function toDTO(m: { id: string; role: string; content: string; createdAt: Date }): ChatMsg {
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }
}

export async function GET() {
  try {
    const me = await requireActiveUser()
    const messages = await db.chatMessage.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    })
    return Response.json({ messages: messages.map(toDTO) })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest) {
  // ---- Validación y guardado ANTES de abrir el stream (cookies + BD) ----
  let me: Awaited<ReturnType<typeof requireActiveUser>>
  let message: string
  let useWeb = false
  try {
    me = await requireActiveUser()
    const body = (await req.json().catch(() => ({}))) as { message?: unknown; web?: unknown }
    message = String(body.message ?? "").trim()
    useWeb = body.web === true
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

  // Historial reciente como contexto
  const history = await db.chatMessage
    .findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY,
    })
    .catch(() => [])
  history.reverse()

  // Guardar el mensaje del usuario ANTES de llamar al modelo
  const savedUser = await db.chatMessage.create({
    data: { userId: me.id, role: "user", content: message },
  })

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
          ...history.map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          })),
          { role: "user" as const, content: message },
        ]

        let acc = ""
        for await (const delta of oracleStreamWith(systemPrompt, modelMessages)) {
          acc += delta
          send({ t: "delta", v: delta })
        }

        if (!acc.trim()) throw new Error("respuesta vacía del modelo")

        const saved = await db.chatMessage.create({
          data: { userId: me.id, role: "assistant", content: acc.slice(0, MAX_CONTENT) },
        })
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

export async function DELETE() {
  try {
    const me = await requireActiveUser()
    await db.chatMessage.deleteMany({ where: { userId: me.id } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

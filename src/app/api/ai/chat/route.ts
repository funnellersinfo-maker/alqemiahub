// /api/ai/chat — El Oráculo: asistente IA del Hub
// GET: historial · POST: mensaje (multi-turno) · DELETE: nueva conversación
// El modelo se resuelve en @/lib/ai (Workers AI en producción · SDK local en dev)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError } from "@/lib/api-helpers"
import { oracleComplete } from "@/lib/ai"
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
  try {
    const me = await requireActiveUser()
    const body = (await req.json().catch(() => ({}))) as { message?: unknown }
    const message = String(body.message ?? "").trim()
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

    // Historial reciente como contexto
    const history = await db.chatMessage.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY,
    })
    history.reverse()

    // Guardar el mensaje del usuario ANTES de llamar al modelo
    await db.chatMessage.create({ data: { userId: me.id, role: "user", content: message } })

    let reply: string
    try {
      reply = await oracleComplete([
        ...history.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content })),
        { role: "user", content: message },
      ])
    } catch (err) {
      // El modelo falló: se retira el mensaje guardado para no ensuciar el hilo
      await db.chatMessage.deleteMany({ where: { userId: me.id, role: "user", content: message } })
      console.error("[api/ai/chat] Error del modelo:", err)
      throw new ApiError(502, "El Oráculo no pudo responder. Intenta de nuevo en unos segundos.")
    }

    const saved = await db.chatMessage.create({
      data: { userId: me.id, role: "assistant", content: reply.slice(0, MAX_CONTENT) },
    })

    return Response.json({ reply: toDTO(saved) })
  } catch (e) {
    return handleApiError(e)
  }
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

// /api/ai/chat — El Oráculo: asistente IA del Hub (z-ai-web-dev-sdk, SOLO backend)
// GET: historial · POST: mensaje (con contexto multi-turno) · DELETE: nueva conversación
import { NextRequest } from "next/server"
import ZAI from "z-ai-web-dev-sdk"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError } from "@/lib/api-helpers"
import type { ChatMsg } from "@/lib/types"

const SYSTEM_PROMPT = `Eres El Oráculo, el asistente de IA del Hub ALQEMIA, la academia premium de marketing y ecommerce de la comunidad. Tu misión es ayudar a los miembros a transmutar su marketing en ventas.

Tu estilo:
- Respondes en español, de forma clara, directa y accionable.
- Eres experto en: marketing digital, ecommerce (Shopify, WooCommerce, catálogos), Meta Ads, Google Ads, TikTok Ads, copywriting, embudos de venta, email marketing, branding, precios, ofertas, contenido orgánico y estrategia de lanzamientos.
- Cuando te pidan copys, ideas o planes, entregas opciones concretas y listas para usar (no te quedas en teoría).
- Usas formato markdown ligero (negritas, listas) para que sea fácil leer.
- Si preguntan algo ajeno al marketing/negocios, ayudas igual con buena actitud, pero recuerda tu especialidad.
- Terminas con una pregunta o siguiente paso accionable cuando aporte valor.`

const MAX_HISTORY = 16 // mensajes enviados al modelo como contexto
const MAX_CONTENT = 8000
const DAILY_LIMIT = 60 // anti-abuso razonable

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

    await db.chatMessage.create({ data: { userId: me.id, role: "user", content: message } })

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        ...history.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
        { role: "user", content: message },
      ],
      thinking: { type: "disabled" },
    })

    const reply = completion.choices[0]?.message?.content?.trim()
    if (!reply) throw new ApiError(502, "El Oráculo no respondió. Intenta de nuevo.")

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

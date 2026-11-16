// /api/ai/image — El Oráculo · Forja de imágenes HD (gratis, sin API key)
// POST { prompt, size?: "square"|"landscape"|"portrait", conversationId? }
//   → { conversationId, userMsg, msg }
// Genera con Pollinations.ai (modelo FLUX.1) desde el servidor, aplica un
// límite anti-abuso de 20 imágenes/día y guarda la imagen (dataURL JPEG) como
// mensaje de la conversación. Si el prompt no trae conversationId, se crea
// una conversación nueva titulada con el prompt (solo si la imagen salió bien,
// para no dejar conversaciones vacías).
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError } from "@/lib/api-helpers"
import type { ChatMsg } from "@/lib/types"

const MAX_PROMPT = 1000
const DAILY_IMAGE_LIMIT = 20

const SIZES = {
  square: "1024x1024",
  landscape: "1344x768",
  portrait: "768x1344",
} as const
type SizeKey = keyof typeof SIZES

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

/** Título de conversación nueva: primeras ~42 letras del prompt
 *  recortadas a palabra completa (sin cortar palabras a la mitad). */
function buildTitle(text: string, max = 42): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > 16 ? cut.slice(0, lastSpace) : cut).trim() || cut
}

/**
 * Forja una imagen HD con Pollinations.ai (FLUX.1, gratis, sin API key).
 * Devuelve un dataURL JPEG listo para guardar. Nunca deja el request colgado:
 * timeout de 90s y errores convertidos a ApiError 502 con mensaje amable.
 */
async function forgeImage(prompt: string, size: string): Promise<string> {
  const [w, h] = size.split("x")
  const seed = Math.floor(Math.random() * 1e9)
  const promptEnhanced = `${prompt}. hyperrealistic, ultra detailed, professional photography, 8k, cinematic lighting, sharp focus`
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptEnhanced)}?width=${w}&height=${h}&model=flux&nologo=true&enhance=true&seed=${seed}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) })
    if (!res.ok) throw new ApiError(502, "El forjador de imágenes no respondió. Intenta de nuevo.")
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < 1000) throw new ApiError(502, "La imagen llegó vacía. Intenta con otro prompt.")
    return `data:image/jpeg;base64,${buf.toString("base64")}`
  } catch (e) {
    if (e instanceof ApiError) throw e
    console.error("[api/ai/image] Pollinations falló:", e)
    throw new ApiError(502, "El forjador de imágenes no respondió. Intenta de nuevo en unos segundos.")
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: unknown
      size?: unknown
      conversationId?: unknown
    }
    const prompt = String(body.prompt ?? "").trim()
    const sizeKey: SizeKey =
      body.size === "landscape" ? "landscape" : body.size === "portrait" ? "portrait" : "square"
    if (!prompt) throw new ApiError(400, "Describe la imagen que quieres forjar")
    if (prompt.length > MAX_PROMPT) {
      throw new ApiError(400, "La descripción es demasiado larga (máx. 1000 caracteres)")
    }

    // Anti-abuso: límite de imágenes por día (mensajes kind "image" en 24h)
    const dayAgo = new Date(Date.now() - 24 * 3600_000)
    const imagesToday = await db.chatMessage.count({
      where: { userId: me.id, kind: "image", createdAt: { gte: dayAgo } },
    })
    if (imagesToday >= DAILY_IMAGE_LIMIT) {
      throw new ApiError(429, "Llegaste al límite diario de imágenes (20/día). Vuelve mañana.")
    }

    // Conversación: verificar dueño (si trae) antes de forjar
    let conversationId: string | null = null
    if (typeof body.conversationId === "string" && body.conversationId.trim()) {
      const conv = await db.conversation.findFirst({
        where: { id: body.conversationId.trim(), userId: me.id },
      })
      if (!conv) throw new ApiError(404, "La conversación no existe")
      conversationId = conv.id
    }

    // Forjar la imagen (si falla, no se crea nada en la BD)
    const size = SIZES[sizeKey]
    const dataUrl = await forgeImage(prompt, size)

    // Conversación nueva solo cuando la imagen ya salió bien
    if (!conversationId) {
      const created = await db.conversation.create({
        data: { userId: me.id, title: buildTitle(prompt) },
      })
      conversationId = created.id
    }

    // Mensaje del usuario (el pedido) + mensaje asistente con la imagen
    const userMsg = await db.chatMessage.create({
      data: { userId: me.id, conversationId, role: "user", content: prompt, kind: "text" },
    })
    const msg = await db.chatMessage.create({
      data: {
        userId: me.id,
        conversationId,
        role: "assistant",
        content: prompt,
        kind: "image",
        imagePrompt: prompt,
        imageSize: size,
        imageData: dataUrl,
      },
    })
    await db.conversation
      .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
      .catch(() => {})

    return Response.json({ conversationId, userMsg: toDTO(userMsg), msg: toDTO(msg) })
  } catch (e) {
    return handleApiError(e)
  }
}

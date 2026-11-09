// POST /api/tools/copylab — Generador de copy con IA (3 variantes)
import { NextRequest } from "next/server"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import ZAI from "z-ai-web-dev-sdk"
import type { CopyLabType } from "@/lib/types"

const COPY_TYPES: readonly CopyLabType[] = ["product", "social", "ad", "email"] as const

const TYPE_PROMPTS: Record<CopyLabType, string> = {
  product: "Escribe una ficha de producto para ecommerce",
  social: "Escribe un post corto para redes sociales (con gancho + CTA)",
  ad: "Escribe un guion corto para anuncio de Meta Ads (gancho, cuerpo, CTA)",
  email: "Escribe un email de venta (asunto + cuerpo corto + CTA)",
}

const SYSTEM_PROMPT =
  "Eres un copywriter senior de marketing directo para ecommerce y negocios digitales. Escribes en español neutro, persuasivo y concreto, sin frases vacías ni exageraciones. Devuelves EXACTAMENTE un array JSON con 3 strings (3 variantes distintas de copy), sin markdown ni texto adicional."

const COPYLAB_UNAVAILABLE =
  "El CopyLab no está disponible en este momento. Intenta en unos segundos."

/**
 * Recupera las variantes del texto del modelo:
 * 1) JSON directo → 2) primer "[" ... último "]" → 3) bloques por párrafo/línea numerada → 4) texto tal cual.
 */
function parseVariants(text: string): string[] {
  // 1) JSON directo
  try {
    const parsed: unknown = JSON.parse(text)
    const strings = extractStrings(parsed)
    if (strings.length > 0) return strings
  } catch {
    // seguir con las estrategias de recuperación
  }

  // 2) Extraer contenido entre el primer "[" y el último "]" y reintentar
  const first = text.indexOf("[")
  const last = text.lastIndexOf("]")
  if (first !== -1 && last > first) {
    try {
      const parsed: unknown = JSON.parse(text.slice(first, last + 1))
      const strings = extractStrings(parsed)
      if (strings.length > 0) return strings
    } catch {
      // seguir
    }
  }

  // 3) Dividir por párrafos o entradas numeradas
  const blocks = text
    .split(/\n{2,}/)
    .flatMap((paragraph) => paragraph.split(/\n(?=\s*\d+[.)]\s)/))
    .map((block) => block.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((block) => block.length > 0)
  if (blocks.length > 0) return blocks

  // 4) Último recurso: el texto tal cual
  return [text]
}

function extractStrings(parsed: unknown): string[] {
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === "string")
}

export async function POST(req: NextRequest) {
  try {
    await requireActiveUser()
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    const type = typeof body.type === "string" ? body.type : ""
    if (!COPY_TYPES.includes(type as CopyLabType)) {
      return errorResponse(400, "Tipo inválido")
    }
    const copyType = type as CopyLabType

    const product = typeof body.product === "string" ? body.product.trim() : ""
    if (product.length < 1 || product.length > 300) {
      return errorResponse(400, "Describe tu producto")
    }

    const audience = typeof body.audience === "string" ? body.audience.trim() : ""
    if (audience.length > 200) {
      return errorResponse(400, "La audiencia es demasiado larga")
    }

    const toneRaw = typeof body.tone === "string" ? body.tone.trim() : ""
    const tone = toneRaw.length === 0 ? "Profesional" : toneRaw
    if (tone.length > 30) {
      return errorResponse(400, "El tono no puede superar los 30 caracteres")
    }

    const userPrompt = `${TYPE_PROMPTS[copyType]}\nProducto/servicio: ${product}\nAudiencia: ${audience}\nTono: ${tone}`

    // Generación con SDK (solo backend) + timeout de 60s
    let raw = ""
    try {
      const zai = await ZAI.create()
      const request = zai.chat.completions.create({
        messages: [
          { role: "assistant", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
      })

      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("CopyLab timeout")), 60_000)
      })
      try {
        const completion = await Promise.race([request, timeout])
        raw = completion.choices[0]?.message?.content ?? ""
      } finally {
        if (timer) clearTimeout(timer)
      }
    } catch (err) {
      console.error("[api/tools/copylab] Error generando copy:", err)
      return errorResponse(502, COPYLAB_UNAVAILABLE)
    }

    // Sanitizar: solo strings no vacíos, máximo 3 variantes
    const results = parseVariants(raw)
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .slice(0, 3)
      .map((s) => s.trim())

    if (results.length === 0) {
      return errorResponse(502, COPYLAB_UNAVAILABLE)
    }

    return Response.json({ results })
  } catch (e) {
    return handleApiError(e)
  }
}

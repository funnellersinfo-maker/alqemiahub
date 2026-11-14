// POST /api/tools/copylab — CopyLab de élite
// 3 variantes con los más altos estándares de copywriting:
// AIDA · PAS · PASTOR + niveles de conciencia de Eugene Schwartz
// + sesgos cognitivos + gatillos mentales + neuromarketing.
// Usa el motor multi-entorno de @/lib/ai: en producción corre sobre
// Cloudflare Workers AI (binding AI); en desarrollo, con el SDK local.
import { NextRequest } from "next/server"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { oracleCompleteWith } from "@/lib/ai"
import type { CopyLabAwareness, CopyLabType, CopyLabVariant } from "@/lib/types"

const COPY_TYPES: readonly CopyLabType[] = ["product", "social", "ad", "email"] as const
const AWARENESS_LEVELS: readonly CopyLabAwareness[] = [
  "auto",
  "unconscious",
  "problem",
  "solution",
  "product",
  "most",
] as const

const TYPE_PROMPTS: Record<CopyLabType, string> = {
  product: "Ficha de producto para ecommerce",
  social: "Post para redes sociales",
  ad: "Guion de anuncio para Meta/TikTok Ads (15-30 seg)",
  email: "Email de venta (asunto + preview + cuerpo + CTA)",
}

const AWARENESS_PROMPTS: Record<CopyLabAwareness, string> = {
  auto: "Detecta tú mismo el nivel de conciencia más probable de esta audiencia y ajústalo",
  unconscious: "Nivel 1 — INCONSCIENTE: apenas siente la molestia, no sabe que tiene un problema. Primero hazle sentir el dolor y nómbralo con sus propias palabras",
  problem: "Nivel 2 — CONSCIENTE DEL PROBLEMA: sabe que tiene el problema, no sabe que existen soluciones. Agita el costo de no resolverlo y presenta tu producto como el puente",
  solution: "Nivel 3 — CONSCIENTE DE LA SOLUCIÓN: sabe que hay soluciones, no te conoce a ti. Diferénciate: por qué TU solución es la más rápida, simple o segura",
  product: "Nivel 4 — CONSCIENTE DEL PRODUCTO: ya te conoce, no ha comprado. Derriba objeciones (precio, tiempo, confianza) con prueba y oferta irresistible",
  most: "Nivel 5 — PLENAMENTE CONSCIENTE: compara con la competencia. Gana con oferta concreta, prueba social abrumadora, urgencia real y cierre directo",
}

// ============================================================
// EL SISTEMA — Escuela de copywriting de élite
// ============================================================
const SYSTEM_PROMPT = `Eres un copywriter de élite mundial formado en marketing directo (Gary Halbert, David Ogilvy, Dan Kennedy) y neuromarketing (Roger Dooley). Escribes copys en español que VENDEN de verdad. Cada variante que entregas es publicable tal cual.

REGLAS OBLIGATORIAS (sin excepción):

1. FRAMEWORK ESTRUCTURAL — cada variante usa un framework distinto y respeta sus fases explícitamente:
   · AIDA: Atención (gancho que interrumpe el scroll: dato brutal, pregunta incómoda o promesa específica) → Interés (revelación que explica el problema de forma nueva) → Deseo (beneficios sensoriales y emocionales, no funciones: lo que SIENTE y LOGRA el cliente) → Acción (CTA imperativo con incentivo para actuar YA).
   · PAS: Problema (el dolor exacto, dicho con las palabras del cliente) → Agitación (el costo real de no resolverlo: qué pierde cada día que pasa, aversión a la pérdida) → Solución (tu producto como el puente + CTA).
   · PASTOR: Persona (conecta con la audiencia: "tú que...") → Amplificación (por qué este problema es urgente ahora) → Historia (mini-relato de transformación o testimonio) → Testimonio/Prueba (dato o resultado verificable) → Oferta (qué incluye + garantía/valor) → Respuesta (CTA con urgencia).

2. NIVEL DE CONCIENCIA (Eugene Schwartz) — adapta el ángulo al nivel indicado. A menor conciencia: primero se educa y se nombra el dolor. A mayor conciencia: directo a diferenciación, prueba y oferta. Nunca le vendas "solución" a alguien que aún no sabe que tiene problema.

3. GATILLOS MENTALES Y SESGOS — usa MÍNIMO 3 por variante, eligiendo los más honestos y relevantes para esta audiencia: prueba social, autoridad, escasez, urgencia, aversión a la pérdida, anclaje, reciprocidad, pertenencia/tribu, curiosidad, especificidad, novedad, aversión al riesgo (garantía).

4. NEUROMARKETING —
   · Escribe en segunda persona ("tú"), el cerebro se involucra.
   · Emoción primero, lógica después (justifica la compra con razón, véndela con emoción).
   · Números específicos, nunca vaguezas ("7 de cada 10", no "la mayoría").
   · Detalles sensoriales y concretos (qué ve, siente, evita).
   · Ritmo: frases cortas que golpean. Alguna larga para respirar.
   · El gancho de la primera línea decide todo: dedícale el mayor esfuerzo.

5. PROHIBIDO ABSOLUTAMENTE — frases genéricas ("calidad garantizada", "no esperes más", "el mejor del mercado" sin prueba), clichés vacíos, promesas irreales, adjetivos sin evidencia, bullets que no comunican beneficio.

FORMATO DE SALIDA — responde EXACTAMENTE con un array JSON (sin markdown, sin texto antes ni después) de 3 objetos, uno por framework en este orden: AIDA, PAS, PASTOR:
[{"framework":"AIDA","copy":"el copy completo listo para publicar, con saltos de línea donde ayuden","triggers":["gatillo 1","gatillo 2","gatillo 3"],"why":"por qué funciona: la psicología que explota, en una frase concreta"}]

El "copy" debe ser sustancioso y completo para el formato pedido (una ficha real, un post real, un guion real, un email real). Los "triggers" son 3-5 gatillos/sesgos usados. "why" es UNA frase que enseña al usuario POR QUÉ ese copy convierte.`

const COPYLAB_UNAVAILABLE =
  "El CopyLab no está disponible en este momento. Intenta en unos segundos."

// ============================================================
// Parser robusto: JSON → recuperación por bloques
// ============================================================

/** Normaliza cualquier objeto/string del modelo a CopyLabVariant. */
function toVariant(item: unknown, index: number): CopyLabVariant | null {
  if (typeof item === "string") {
    const t = item.trim()
    if (!t) return null
    return { framework: `Variante ${index + 1}`, copy: t, triggers: [], why: "" }
  }
  if (item && typeof item === "object") {
    const o = item as {
      framework?: unknown
      copy?: unknown
      text?: unknown
      triggers?: unknown
      why?: unknown
    }
    const copy = typeof o.copy === "string" ? o.copy.trim() : typeof o.text === "string" ? o.text.trim() : ""
    if (!copy) return null
    const framework = typeof o.framework === "string" && o.framework.trim() ? o.framework.trim() : `Variante ${index + 1}`
    const triggers = Array.isArray(o.triggers)
      ? o.triggers.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 5)
      : []
    const why = typeof o.why === "string" ? o.why.trim() : ""
    return { framework, copy, triggers, why }
  }
  return null
}

/**
 * Recupera las 3 variantes del texto del modelo:
 * 1) JSON directo → 2) contenido entre primer "[" y último "]" →
 * 3) bloques por párrafo/entrada numerada → 4) texto tal cual.
 */
function parseVariants(text: string): CopyLabVariant[] {
  // 1) JSON directo
  try {
    const parsed: unknown = JSON.parse(text)
    const list = collectFromParsed(parsed)
    if (list.length > 0) return list
  } catch {
    // seguir con las estrategias de recuperación
  }

  // 2) Extraer contenido entre el primer "[" y el último "]" y reintentar
  const first = text.indexOf("[")
  const last = text.lastIndexOf("]")
  if (first !== -1 && last > first) {
    try {
      const parsed: unknown = JSON.parse(text.slice(first, last + 1))
      const list = collectFromParsed(parsed)
      if (list.length > 0) return list
    } catch {
      // seguir
    }
  }

  // 3) Dividir por párrafos o entradas numeradas (con encabezado tipo "AIDA:")
  const blocks = text
    .split(/\n{2,}/)
    .flatMap((paragraph) => paragraph.split(/\n(?=\s*(?:\d+[.)]|AIDA|PAS\b|PASTOR))/i))
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
  const variants: CopyLabVariant[] = []
  for (const block of blocks) {
    const fw = block.match(/^(?:\d+[.)]\s*)?((?:AIDA|PAS|PASTOR))\s*[:—-]/i)
    const v = toVariant(block.replace(/^(?:\d+[.)]\s*)?(?:AIDA|PAS|PASTOR)\s*[:—-]\s*/i, ""), variants.length)
    if (v) {
      if (fw) v.framework = fw[1].toUpperCase()
      variants.push(v)
    }
  }
  if (variants.length > 0) return variants

  // 4) Último recurso: el texto tal cual
  const fallback = toVariant(text, 0)
  return fallback ? [fallback] : []
}

/** Recoge variantes de un JSON ya parseado (array, o objeto con arrays dentro). */
function collectFromParsed(parsed: unknown): CopyLabVariant[] {
  const out: CopyLabVariant[] = []
  const visit = (node: unknown, depth: number) => {
    if (depth > 3 || out.length >= 3) return
    if (Array.isArray(node)) {
      for (const item of node) {
        const v = toVariant(item, out.length)
        if (v) out.push(v)
      }
      if (out.length === 0) {
        for (const item of node) visit(item, depth + 1)
      }
      return
    }
    if (node && typeof node === "object") {
      for (const value of Object.values(node as Record<string, unknown>)) {
        if (out.length >= 3) return
        visit(value, depth + 1)
      }
    }
  }
  visit(parsed, 0)
  return out.slice(0, 3)
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

    const awarenessRaw = typeof body.awareness === "string" ? body.awareness : "auto"
    const awareness = AWARENESS_LEVELS.includes(awarenessRaw as CopyLabAwareness)
      ? (awarenessRaw as CopyLabAwareness)
      : "auto"

    const userPrompt = `FORMATO REQUERIDO: ${TYPE_PROMPTS[copyType]}.
Producto/servicio: ${product}
Audiencia: ${audience || "define tú la audiencia más probable para este producto"}
Tono de voz: ${tone}
Nivel de conciencia de la audiencia: ${AWARENESS_PROMPTS[awareness]}
Hoy es ${new Date().toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" })}.

Genera las 3 variantes (AIDA, PAS, PASTOR) siguiendo TODAS las reglas. En "why" enseña al usuario la psicología detrás.`

    // Generación con el motor multi-entorno (producción: Workers AI)
    let raw = ""
    try {
      raw = await oracleCompleteWith(SYSTEM_PROMPT, [{ role: "user", content: userPrompt }], {
        maxTokens: 1800,
      })
    } catch (err) {
      console.error("[api/tools/copylab] Error generando copy:", err)
      return errorResponse(502, COPYLAB_UNAVAILABLE)
    }

    // Sanitizar: máximo 3 variantes con contenido real
    const results = parseVariants(raw).slice(0, 3)

    if (results.length === 0) {
      return errorResponse(502, COPYLAB_UNAVAILABLE)
    }

    return Response.json({ results })
  } catch (e) {
    return handleApiError(e)
  }
}

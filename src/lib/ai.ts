// ============================================================
// ALQEMIA — El Oráculo: cliente de IA multi-entorno
// 1) Cloudflare Workers AI (producción): el modelo corre dentro
//    de la propia infraestructura de Cloudflare (sin API keys)
// 2) API directa por entorno (ZAI_BASE_URL / ZAI_API_KEY)
// 3) SDK local del sandbox (z-ai-web-dev-sdk, solo desarrollo)
// ============================================================

import { getCloudflareContext } from "@opennextjs/cloudflare"

export const ORACLE_SYSTEM_PROMPT = `Eres El Oráculo, el asistente de IA del Hub ALQEMIA, la academia premium de marketing y ecommerce de la comunidad. Tu misión es ayudar a los miembros a transmutar su marketing en ventas.

Tu estilo:
- Respondes en español, de forma clara, directa y accionable.
- Eres experto en: marketing digital, ecommerce (Shopify, WooCommerce, catálogos), Meta Ads, Google Ads, TikTok Ads, copywriting, embudos de venta, email marketing, branding, precios, ofertas, contenido orgánico y estrategia de lanzamientos.
- Cuando te pidan copys, ideas o planes, entregas opciones concretas y listas para usar (no te quedas en teoría).
- Usas formato markdown ligero (negritas, listas) para que sea fácil leer.
- Si preguntan algo ajeno al marketing/negocios, ayudas igual con buena actitud, pero recuerda tu especialidad.
- Terminas con una pregunta o siguiente paso accionable cuando aporte valor.`

type ChatMessage = { role: "user" | "assistant"; content: string }

interface WorkersAI {
  run: (model: string, input: unknown) => Promise<unknown>
}

/** Binding de Cloudflare Workers AI dentro de la petición (o null). */
function getWorkersAI(): WorkersAI | null {
  const manual = (globalThis as unknown as { __ALQEMIA_CF_ENV__?: { AI?: WorkersAI } }).__ALQEMIA_CF_ENV__
  if (manual?.AI) return manual.AI
  try {
    const ctx = getCloudflareContext() as { env?: { AI?: WorkersAI } } | null
    if (ctx?.env?.AI) return ctx.env.AI
  } catch {
    // Sin contexto de Cloudflare (desarrollo local / build)
  }
  return null
}

async function runWorkersAI(
  ai: WorkersAI,
  systemPrompt: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {}
): Promise<string> {
  const input = {
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: opts.maxTokens ?? 1400,
  }
  // Modelo principal; si falla, se prueba el ligero
  const models = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-8b-instruct",
  ]
  let lastError: unknown = null
  for (const model of models) {
    try {
      const content = await readAiResponse(await ai.run(model, input))
      if (content) return content
      lastError = new Error(`respuesta vacía de ${model}`)
      console.error(`[oracle] ${model} respondió vacío`)
    } catch (e) {
      lastError = e
      console.error(`[oracle] ${model} falló:`, e instanceof Error ? e.message : e)
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Workers AI no respondió")
}

/**
 * Workers AI puede responder de varias formas según el backend que sirva el
 * modelo: { response: string }, string directo, o un ReadableStream (SSE o
 * texto). Este lector normaliza todas a un string.
 */
async function readAiResponse(result: unknown): Promise<string | null> {
  // string directo
  if (typeof result === "string") return result.trim() || null

  // ReadableStream al nivel superior
  if (typeof ReadableStream !== "undefined" && result instanceof ReadableStream) {
    return readStreamText(await new Response(result).text())
  }

  if (result && typeof result === "object") {
    const res = (result as { response?: unknown }).response
    if (typeof res === "string") return res.trim() || null
    if (typeof ReadableStream !== "undefined" && res instanceof ReadableStream) {
      return readStreamText(await new Response(res).text())
    }
    // respuesta tipo OpenAI (choices)
    const choices = (result as { choices?: { message?: { content?: string } }[] }).choices
    const c = choices?.[0]?.message?.content
    if (typeof c === "string") return c.trim() || null
  }
  return null
}

/** Convierte el texto de un stream (SSE o plano) en un string limpio. */
function readStreamText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  // SSE: líneas "data: {...}"
  if (trimmed.startsWith("data:") || trimmed.includes("\ndata:")) {
    let out = ""
    for (const line of trimmed.split("\n")) {
      const l = line.trim()
      if (!l.startsWith("data:")) continue
      const payload = l.slice(5).trim()
      if (!payload || payload === "[DONE]") continue
      try {
        const obj = JSON.parse(payload) as {
          response?: string
          delta?: { content?: string; response?: string }
          choices?: { delta?: { content?: string } }[]
        }
        out += obj.response ?? obj.delta?.content ?? obj.delta?.response ?? obj.choices?.[0]?.delta?.content ?? ""
      } catch {
        // línea no-JSON: se ignora
      }
    }
    return out.trim() || null
  }
  return trimmed
}

/** Llama a la API interna con la configuración del entorno (si existe). */
async function runDirectApi(systemPrompt: string, messages: ChatMessage[]): Promise<string | null> {
  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY
  if (!baseUrl || !apiKey) return null

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Z-AI-From": "Z",
  }
  if (process.env.ZAI_CHAT_ID) headers["X-Chat-Id"] = process.env.ZAI_CHAT_ID
  if (process.env.ZAI_USER_ID) headers["X-User-Id"] = process.env.ZAI_USER_ID
  if (process.env.ZAI_TOKEN) headers["X-Token"] = process.env.ZAI_TOKEN

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55_000)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [{ role: "assistant", content: systemPrompt }, ...messages],
        thinking: { type: "disabled" },
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error("respuesta vacía")
    return content
  } finally {
    clearTimeout(timer)
  }
}

/** SDK local del sandbox (importación diferida; solo desarrollo). */
async function runLocalSdk(systemPrompt: string, messages: ChatMessage[]): Promise<string | null> {
  const spec = ["z-ai", "web-dev-sdk"].join("-")
  const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ spec).catch(() => null)) as {
    default?: {
      create: () => Promise<{
        chat: { completions: { create: (opts: unknown) => Promise<{ choices: { message: { content?: string } }[] }> } }
      }>
    }
  } | null
  if (!mod?.default?.create) return null

  const zai = await mod.default.create()
  const completion = await zai.chat.completions.create({
    messages: [{ role: "assistant", content: systemPrompt }, ...messages],
    thinking: { type: "disabled" },
  })
  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) throw new Error("respuesta vacía del SDK")
  return content
}

/**
 * Cadena de modos del Oráculo:
 *   Workers AI (producción) → API directa por entorno → SDK local (dev).
 * Lanza si ningún modo logra responder.
 */
export async function oracleComplete(messages: ChatMessage[]): Promise<string> {
  return oracleCompleteWith(ORACLE_SYSTEM_PROMPT, messages)
}

/** Igual que oracleComplete pero con system prompt personalizado (CopyLab, etc.). */
export async function oracleCompleteWith(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {}
): Promise<string> {
  const raw = await runChain(systemPrompt, messages, opts)
  if (!raw) throw new Error("El Oráculo no está disponible en este entorno")
  return raw
}

async function runChain(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number }
): Promise<string | null> {
  // 1) Cloudflare Workers AI (producción)
  const ai = getWorkersAI()
  if (ai) {
    try {
      return await runWorkersAI(ai, systemPrompt, messages, opts)
    } catch (e) {
      console.error("[oracle] Workers AI falló:", e)
      // Continúa con los siguientes modos
    }
  }

  // 2) API directa por entorno
  try {
    const direct = await runDirectApi(systemPrompt, messages)
    if (direct) return direct
  } catch (e) {
    console.error("[oracle] API directa falló:", e)
  }

  // 3) SDK local (sandbox / desarrollo)
  return runLocalSdk(systemPrompt, messages)
}

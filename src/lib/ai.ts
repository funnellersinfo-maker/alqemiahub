// ============================================================
// ALQEMIA — El Oráculo: cliente de IA multi-entorno
// 1) Cloudflare Workers AI (producción): el modelo corre dentro
//    de la propia infraestructura de Cloudflare (sin API keys)
// 2) API directa por entorno (ZAI_BASE_URL / ZAI_API_KEY)
// 3) SDK local del sandbox (z-ai-web-dev-sdk, solo desarrollo)
// Además: streaming real (SSE → deltas) y búsqueda web
// multi-entorno (SDK local → DuckDuckGo como universal).
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

// ============================================================
// STREAMING — deltas en tiempo real (tipo ChatGPT)
// ============================================================

/** Extrae el delta de texto de un evento SSE en cualquiera de
 *  los formatos conocidos (Workers AI, OpenAI-like, gateway Z). */
function extractDelta(obj: Record<string, unknown>): string {
  const response = (obj as { response?: unknown }).response
  if (typeof response === "string") return response
  const choices = (obj as { choices?: { delta?: { content?: string }; message?: { content?: string } }[] }).choices
  const delta = choices?.[0]?.delta?.content ?? choices?.[0]?.message?.content
  if (typeof delta === "string") return delta
  const nested = (obj as { delta?: { content?: string; response?: string } }).delta
  if (nested && typeof (nested.content ?? nested.response) === "string") {
    return (nested.content ?? nested.response) as string
  }
  return ""
}

/** Lee un stream SSE línea por línea y emite cada delta de texto. */
async function* sseDeltas(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const dec = new TextDecoder()
  let buf = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line.startsWith("data:")) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue
        try {
          const obj = JSON.parse(payload) as Record<string, unknown>
          const delta = extractDelta(obj)
          if (delta) yield delta
        } catch {
          // línea no-JSON: se ignora
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Workers AI en modo stream: ai.run(model, { ...input, stream: true }). */
async function* streamWorkersAI(
  ai: WorkersAI,
  systemPrompt: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number }
): AsyncGenerator<string> {
  const input = {
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: opts.maxTokens ?? 1400,
    stream: true,
  }
  const models = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-8b-instruct",
  ]
  let lastError: unknown = null
  for (const model of models) {
    try {
      const result = (await ai.run(model, input)) as unknown
      if (typeof ReadableStream !== "undefined" && result instanceof ReadableStream) {
        let emitted = false
        for await (const delta of sseDeltas(result)) {
          emitted = true
          yield delta
        }
        if (emitted) return
        lastError = new Error(`stream vacío de ${model}`)
      } else {
        // El backend no transmitió: se normaliza a texto completo
        const text = await readAiResponse(result)
        if (text) {
          yield text
          return
        }
        lastError = new Error(`respuesta vacía de ${model}`)
      }
    } catch (e) {
      lastError = e
      console.error(`[oracle:stream] ${model} falló:`, e instanceof Error ? e.message : e)
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Workers AI no respondió")
}

/** SDK local en modo stream (devuelve ReadableStream SSE OpenAI-like). */
async function* streamLocalSdk(
  systemPrompt: string,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const spec = ["z-ai", "web-dev-sdk"].join("-")
  const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ spec).catch(() => null)) as {
    default?: {
      create: () => Promise<{
        chat: {
          completions: {
            create: (opts: unknown) => Promise<
              | { choices: { message: { content?: string } }[] }
              | ReadableStream<Uint8Array>
            >
          }
        }
      }>
    }
  } | null
  if (!mod?.default?.create) throw new Error("SDK local no disponible")

  const zai = await mod.default.create()
  const result = (await zai.chat.completions.create({
    messages: [{ role: "assistant", content: systemPrompt }, ...messages],
    thinking: { type: "disabled" },
    stream: true,
  })) as unknown

  if (typeof ReadableStream !== "undefined" && result instanceof ReadableStream) {
    let emitted = false
    for await (const delta of sseDeltas(result)) {
      emitted = true
      yield delta
    }
    if (emitted) return
    throw new Error("stream vacío del SDK")
  }
  // Respuesta completa (sin stream): se emite como un solo delta
  const completion = result as { choices?: { message?: { content?: string } }[] }
  const content = completion.choices?.[0]?.message?.content
  if (typeof content === "string" && content.trim()) {
    yield content
    return
  }
  throw new Error("respuesta vacía del SDK")
}

/**
 * STREAM del Oráculo: genera la respuesta delta por delta.
 * Cadena: Workers AI (prod) → SDK local (dev) → complete de una pieza.
 */
export async function* oracleStreamWith(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {}
): AsyncGenerator<string> {
  // 1) Cloudflare Workers AI (producción)
  const ai = getWorkersAI()
  if (ai) {
    try {
      let first = true
      for await (const delta of streamWorkersAI(ai, systemPrompt, messages, opts)) {
        first = false
        yield delta
      }
      if (!first) return
      console.error("[oracle:stream] Workers AI no emitió deltas; se sigue la cadena")
    } catch (e) {
      console.error("[oracle:stream] Workers AI falló:", e)
    }
  }

  // 2) SDK local en modo stream
  try {
    let first = true
    for await (const delta of streamLocalSdk(systemPrompt, messages)) {
      first = false
      yield delta
    }
    if (!first) return
  } catch (e) {
    console.error("[oracle:stream] SDK local falló:", e)
  }

  // 3) Último recurso: respuesta completa de una pieza
  const text = await oracleCompleteWith(systemPrompt, messages, opts)
  yield text
}

// ============================================================
// BÚSQUEDA WEB — contexto de internet para El Oráculo
// Cadena: SDK local (dev) → DuckDuckGo HTML (universal, sin API key)
// ============================================================

export type WebResult = { title: string; url: string; snippet: string }

/** SDK local: functions.invoke('web_search') — resultados limpios. */
async function webSearchSdk(query: string): Promise<WebResult[]> {
  const spec = ["z-ai", "web-dev-sdk"].join("-")
  const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ spec).catch(() => null)) as {
    default?: {
      create: () => Promise<{
        functions: { invoke: (name: string, args: Record<string, unknown>) => Promise<unknown> }
      }>
    }
  } | null
  if (!mod?.default?.create) return []
  const zai = await mod.default.create()
  const out = (await zai.functions.invoke("web_search", { query, num: 5 })) as unknown
  if (!Array.isArray(out)) return []
  return out
    .map((r) => {
      const o = r as { name?: unknown; url?: unknown; snippet?: unknown }
      return {
        title: typeof o.name === "string" ? o.name : "",
        url: typeof o.url === "string" ? o.url : "",
        snippet: typeof o.snippet === "string" ? o.snippet : "",
      }
    })
    .filter((r) => r.url && r.snippet)
}

/** Elimina etiquetas HTML y entidades comunes de un fragmento. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Bing RSS: resultados en XML sin API key (funciona en CF Workers). */
async function webSearchBing(query: string): Promise<WebResult[]> {
  try {
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const results: WebResult[] = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRe.exec(xml)) !== null) {
      const item = m[1]
      const title = stripHtml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")
      const link = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim()
      const snippet = stripHtml(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "")
      if (title && /^https?:\/\//.test(link)) results.push({ title, url: link, snippet })
      if (results.length >= 5) break
    }
    return results
  } catch {
    return []
  }
}

/** DuckDuckGo HTML: resultados desde html.duckduckgo.com (universal). */
async function webSearchDdg(query: string): Promise<WebResult[]> {
  const urls = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
  ]
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(9000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const results = parseDdgResults(html)
      if (results.length > 0) return results
    } catch {
      // Se intenta el siguiente endpoint
    }
  }
  return []
}

/** Parser tolerante de resultados de DuckDuckGo (html y lite). */
function parseDdgResults(html: string): WebResult[] {
  const results: WebResult[] = []
  const seen = new Set<string>()

  // Enlaces de resultados: href con uddg= (html) o directo (lite)
  const linkRe = /<a[^>]+class="[^"]*result__(?:a|url)[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    let url = m[1]
    // html.duckduckgo.com usa redirección //duckduckgo.com/l/?uddg=<urlencoded>
    const uddg = url.match(/[?&]uddg=([^&]+)/)
    if (uddg) {
      try {
        url = decodeURIComponent(uddg[1])
      } catch {
        continue
      }
    }
    if (!/^https?:\/\//.test(url)) continue
    const title = stripHtml(m[2])
    if (!title || seen.has(url)) continue
    seen.add(url)
    results.push({ title, url, snippet: "" })
  }

  // Snippets: class result__snippet (html) o filas de texto tras el link (lite)
  const snipRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  const snippets: string[] = []
  let s: RegExpExecArray | null
  while ((s = snipRe.exec(html)) !== null) {
    snippets.push(stripHtml(s[1]))
  }
  results.forEach((r, i) => {
    if (snippets[i]) r.snippet = snippets[i]
  })

  return results.filter((r) => r.title).slice(0, 5)
}

/**
 * Búsqueda web con cadena multi-entorno:
 * SDK local (dev) → Bing RSS → DuckDuckGo (todo sin API key).
 */
export async function webSearch(query: string): Promise<WebResult[]> {
  const q = query.trim().slice(0, 300)
  if (!q) return []

  try {
    const sdk = await webSearchSdk(q)
    if (sdk.length > 0) return sdk
  } catch {
    // Sigue con los buscadores públicos
  }

  try {
    const bing = await webSearchBing(q)
    if (bing.length > 0) return bing
  } catch {
    // Sigue con DuckDuckGo
  }

  try {
    const ddg = await webSearchDdg(q)
    if (ddg.length > 0) return ddg
  } catch {
    // Sin resultados
  }
  return []
}

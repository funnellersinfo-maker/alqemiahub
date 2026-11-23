// ============================================================
// MINI-SERVICE edge-tts (SOLO DESARROLLO)
// ------------------------------------------------------------
// Sintetiza voz con el servicio neuronal gratuito de Microsoft
// Edge usando el paquete `ws`, que SÍ admite cabeceras custom
// (Origin / User-Agent / Cookie muid) en el handshake.
//
// En PRODUCCIÓN (Cloudflare Workers) no se usa este servicio:
// la ruta /api/tools/tts se conecta directamente con
// fetch() + Upgrade: websocket dentro del Worker.
//
// Protocolo compartido: ../../src/lib/edge-tts-core.ts
// Puerto fijo: 3031
// ============================================================

import WebSocket, { type RawData } from "ws"
import {
  synthesizeEdge,
  buildEdgeUrl,
  edgeHandshakeHeaders,
  type EdgeSocket,
  type EdgeProsody,
} from "../../src/lib/edge-tts-core"

const PORT = 3031
const MAX_CHARS = 3000
const VOICE_RE = /^es-[A-Z]{2}-[A-Za-z]+Neural$/

/** Abre una conexión Edge-TTS con las cabeceras completas. */
function connect(): Promise<EdgeSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildEdgeUrl("wss"), {
      headers: edgeHandshakeHeaders(),
      handshakeTimeout: 15_000,
    })
    const fail = (err: Error) => {
      try {
        ws.terminate()
      } catch {
        /* noop */
      }
      reject(err)
    }
    ws.once("error", fail)
    ws.once("unexpected-response", (_req, res) =>
      fail(new Error(`handshake-${res.statusCode ?? 0}`))
    )
    ws.once("open", () => {
      resolve({
        send: (d) => ws.send(d),
        close: () => {
          try {
            ws.close()
          } catch {
            /* noop */
          }
        },
        onText: (cb) =>
          ws.on("message", (data: RawData, isBinary: boolean) => {
            if (!isBinary) cb(data.toString("utf-8"))
          }),
        onBinary: (cb) =>
          ws.on("message", (data: RawData, isBinary: boolean) => {
            if (!isBinary) return
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
            const ab = buf.buffer.slice(
              buf.byteOffset,
              buf.byteOffset + buf.byteLength
            ) as ArrayBuffer
            cb(ab)
          }),
        onError: (cb) => ws.on("error", (err: Error) => cb(err)),
        onClose: (cb) => ws.on("close", (code: number) => cb(code, "")),
      })
    })
  })
}

/** Síntesis con un reintento completo (el token DRM rota cada 5 min). */
async function synthesizeWithRetry(params: {
  text: string
  voiceId: string
  prosody: EdgeProsody
}): Promise<Uint8Array> {
  try {
    return await synthesizeEdge(connect, { ...params, timeoutMs: 45_000 })
  } catch {
    return await synthesizeEdge(connect, { ...params, timeoutMs: 45_000 })
  }
}

const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status })

Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") return jsonError("Método no permitido", 405)
    const url = new URL(req.url)
    if (url.pathname !== "/synthesize") return jsonError("No encontrado", 404)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return jsonError("Cuerpo inválido", 400)
    }

    const text = typeof body.text === "string" ? body.text.trim() : ""
    const voice = typeof body.voice === "string" ? body.voice : ""
    if (text.length === 0) return jsonError("Escribe el texto que quieres escuchar", 400)
    if (text.length > MAX_CHARS) return jsonError(`Máximo ${MAX_CHARS} caracteres por generación`, 400)
    if (!VOICE_RE.test(voice)) return jsonError("Voz no disponible", 400)

    const clamp = (v: unknown, min: number, max: number) =>
      Math.min(max, Math.max(min, Math.round(Number(v) || 0)))

    try {
      const audio = await synthesizeWithRetry({
        text,
        voiceId: voice,
        prosody: {
          ratePct: clamp(body.rate, -50, 100),
          pitchHz: clamp(body.pitch, -50, 50),
          volumePct: clamp(body.volume, -50, 50),
        },
      })
      return new Response(audio, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(audio.byteLength),
        },
      })
    } catch (e) {
      const reason = e instanceof Error ? e.message : "error"
      console.error(`[edge-tts] fallo de síntesis (${reason})`)
      return jsonError(
        "El motor de voz no respondió. Intenta de nuevo en unos segundos.",
        502
      )
    }
  },
})

console.log(`[edge-tts] mini-service de desarrollo escuchando en el puerto ${PORT}`)

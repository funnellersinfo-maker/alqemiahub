// ============================================================
// /api/tools/tts — LA VOZ DEL ALQUIMISTA (generador de voz IA)
// POST { text, voice, rate, pitch } → audio MP3 binario
//
// Motor: voces neuronales de Microsoft Edge (Edge-TTS), 100%
// gratuito y sin API key. 40 voces en español con acentos de
// toda Latinoamérica.
//
// Dos caminos de transporte, mismo protocolo (edge-tts-core):
//   · Producción (Cloudflare Workers): fetch() con Upgrade
//     websocket + cabeceras custom (Origin/UA/Cookie muid).
//   · Desarrollo: proxy al mini-service local (puerto 3031,
//     paquete `ws` con cabeceras completas).
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { requireActiveUser, errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import { TTS_VOICE_IDS } from "@/lib/types"
import {
  synthesizeEdge,
  buildEdgeUrl,
  edgeHandshakeHeaders,
  type EdgeSocket,
  type EdgeProsody,
} from "@/lib/edge-tts-core"

const MAX_CHARS = 3000
const MINI_SERVICE = "http://localhost:3031/synthesize"

const isWorkerd =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers"

/** Adaptador del WebSocket de workerd (resp.webSocket) a EdgeSocket. */
function adaptWorkerdSocket(raw: WebSocket & { accept(): void }): EdgeSocket {
  raw.accept()
  try {
    raw.binaryType = "arraybuffer"
  } catch {
    /* workerd ya usa arraybuffer por defecto */
  }
  return {
    send: (d) => raw.send(d),
    close: () => {
      try {
        raw.close()
      } catch {
        /* noop */
      }
    },
    onText: (cb) =>
      raw.addEventListener("message", (ev) => {
        if (typeof ev.data === "string") cb(ev.data)
      }),
    onBinary: (cb) =>
      raw.addEventListener("message", (ev) => {
        if (typeof ev.data !== "string") cb(ev.data as ArrayBuffer)
      }),
    onError: (cb) => raw.addEventListener("error", () => cb(null)),
    onClose: (cb) =>
      raw.addEventListener("close", (ev) => {
        const close = ev as CloseEvent
        cb(close.code, close.reason)
      }),
  }
}

/** Conexión fetch-upgrade con reintento por desfase de reloj (como la referencia). */
function makeWorkerdConnector(): () => Promise<EdgeSocket> {
  let skewSeconds = 0
  let retried = false
  return async () => {
    const attempt = (secs: number) =>
      fetch(buildEdgeUrl("https", secs), {
        headers: { Upgrade: "websocket", ...edgeHandshakeHeaders() },
      }) as Promise<Response & { webSocket?: (WebSocket & { accept(): void }) | null }>

    let resp = await attempt(skewSeconds)
    if (resp.status !== 101 || !resp.webSocket) {
      if (!retried) {
        retried = true
        const dateHeader = resp.headers.get("date")
        const serverTime = dateHeader ? Date.parse(dateHeader) / 1000 : NaN
        if (Number.isFinite(serverTime)) skewSeconds = serverTime - Date.now() / 1000
        resp = await attempt(skewSeconds)
      }
    }
    if (resp.status !== 101 || !resp.webSocket) {
      throw new ApiError(502, "El motor de voz no aceptó la conexión. Intenta de nuevo en unos segundos.")
    }
    return adaptWorkerdSocket(resp.webSocket)
  }
}

function mp3Response(audio: Uint8Array): NextResponse {
  return new NextResponse(audio as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      "Cache-Control": "no-store",
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser()
    void user // herramienta exclusiva de miembros del gremio

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const voice = typeof body.voice === "string" ? body.voice : ""
    const rateRaw = typeof body.rate === "number" ? body.rate : 0
    const pitchRaw = typeof body.pitch === "number" ? body.pitch : 0

    if (text.length === 0) return errorResponse(400, "Escribe el texto que quieres escuchar")
    if (text.length > MAX_CHARS) {
      return errorResponse(400, `Máximo ${MAX_CHARS} caracteres por generación`)
    }
    if (!TTS_VOICE_IDS.has(voice)) return errorResponse(400, "Voz no disponible")

    const prosody: EdgeProsody = {
      ratePct: Math.min(100, Math.max(-50, Math.round(rateRaw))),
      pitchHz: Math.min(50, Math.max(-50, Math.round(pitchRaw))),
      volumePct: 0,
    }

    // ---------- Producción: workerd con fetch-upgrade ----------
    if (isWorkerd) {
      const audio = await synthesizeEdge(makeWorkerdConnector(), {
        text,
        voiceId: voice,
        prosody,
        timeoutMs: 45_000,
      })
      return mp3Response(audio)
    }

    // ---------- Desarrollo: proxy al mini-service local ----------
    const res = await fetch(MINI_SERVICE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice,
        rate: prosody.ratePct,
        pitch: prosody.pitchHz,
        volume: prosody.volumePct,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      let message = "El generador de voz no está disponible. Intenta de nuevo."
      try {
        const data = (await res.json()) as { error?: string }
        if (data && typeof data.error === "string" && data.error) message = data.error
      } catch {
        /* cuerpo sin JSON */
      }
      return errorResponse(res.status === 400 ? 400 : 502, message)
    }
    const audio = new Uint8Array(await res.arrayBuffer())
    if (audio.byteLength < 64) {
      return errorResponse(502, "El motor de voz devolvió audio vacío. Prueba con menos texto.")
    }
    return mp3Response(audio)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg.includes("timeout") || msg.includes("EdgeTtsError: timeout")) {
      return errorResponse(504, "La generación tardó demasiado. Prueba con un texto más corto.")
    }
    return handleApiError(e)
  }
}

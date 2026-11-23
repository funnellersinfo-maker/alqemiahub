// ============================================================
// /api/tools/tts — LA VOZ DEL ALQUIMISTA (generador de voz IA)
// POST { text, voice, speed } → audio binario (mp3/wav)
//
// Dos motores, ambos 100% gratuitos y sin API key:
//   · Motor Google (es, es-US, es-MX, en, pt, fr, it, de…) —
//     TTS público; el texto se trocea en frases (≤200 car.) y
//     los MP3 se concatenan en un solo audio.
//   · Voces de la casa (z-ai SDK: jam, kazi, tongtong…) —
//     premium, con control de velocidad 0.5x–2x (WAV).
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { requireActiveUser, errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import { TTS_VOICES } from "@/lib/types"

const GOOGLE_MAX_CHARS = 3000 // ~15 trozos de 200
const CASA_MAX_CHARS = 1024 // límite del SDK
const GT_CHUNK = 190 // margen bajo el límite de 200 del endpoint

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

/** Trocea el texto en piezas ≤ maxChars cortando por frases. */
function chunkText(text: string, maxChars: number): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [text]
  const chunks: string[] = []
  let current = ""
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      // frase kilométrica: córtala por palabras
      if (current.trim()) {
        chunks.push(current.trim())
        current = ""
      }
      const words = sentence.split(/\s+/)
      for (const w of words) {
        if ((current + " " + w).trim().length > maxChars) {
          if (current.trim()) chunks.push(current.trim())
          current = w.length > maxChars ? w.slice(0, maxChars) : w
        } else {
          current = current ? `${current} ${w}` : w
        }
      }
    } else if ((current + sentence).length > maxChars) {
      if (current.trim()) chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter((c) => c.length > 0)
}

/** Motor Google: TTS público troceado y concatenado (audio/mpeg). */
async function googleTts(text: string, lang: string): Promise<Uint8Array> {
  const chunks = chunkText(text, GT_CHUNK)
  const buffers: Uint8Array[] = []
  for (const chunk of chunks) {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
      `&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(chunk)}`
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://translate.google.com/" },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      throw new ApiError(502, "El motor de voz no respondió. Intenta de nuevo en unos segundos.")
    }
    const data = new Uint8Array(await res.arrayBuffer())
    if (data.byteLength < 64) {
      throw new ApiError(502, "El motor de voz devolvió audio vacío. Prueba con menos texto.")
    }
    buffers.push(data)
  }
  const total = buffers.reduce((acc, b) => acc + b.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    out.set(b, offset)
    offset += b.byteLength
  }
  return out
}

/** Voces de la casa: SDK z-ai (WAV, velocidad 0.5–2.0). */
async function casaTts(text: string, voice: string, speed: number): Promise<Uint8Array> {
  const { default: ZAI } = await import("z-ai-web-dev-sdk")
  const zai = await ZAI.create()
  const response = await zai.audio.tts.create({
    input: text,
    voice,
    speed,
    response_format: "wav",
    stream: false,
  })
  const arrayBuffer = await response.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser()
    void user // herramienta exclusiva de miembros del gremio

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const voiceId = typeof body.voice === "string" ? body.voice : "es"
    const speedRaw = typeof body.speed === "number" ? body.speed : 1

    if (text.length === 0) return errorResponse(400, "Escribe el texto que quieres escuchar")
    if (text.length > GOOGLE_MAX_CHARS) {
      return errorResponse(400, `Máximo ${GOOGLE_MAX_CHARS} caracteres por generación`)
    }

    const voice = TTS_VOICES.find((v) => v.id === voiceId)
    if (!voice) return errorResponse(400, "Voz no disponible")

    if (voice.engine === "google") {
      const audio = await googleTts(text, voice.id)
      return new NextResponse(audio as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(audio.byteLength),
          "Cache-Control": "no-store",
        },
      })
    }

    // Voces de la casa
    if (text.length > CASA_MAX_CHARS) {
      return errorResponse(400, `La voz ${voice.label} admite máximo ${CASA_MAX_CHARS} caracteres`)
    }
    const speed = Math.min(2, Math.max(0.5, Number.isFinite(speedRaw) ? speedRaw : 1))
    const audio = await casaTts(text, voice.id, speed)
    return new NextResponse(audio as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes("1214")) {
      return errorResponse(502, "La voz de la casa no está disponible ahora. Prueba otra voz.")
    }
    return handleApiError(e)
  }
}

// ============================================================
// EDGE-TTS CORE — Protocolo del servicio neuronal de voz de
// Microsoft Edge (gratuito, sin API key).
//
// Capa compartida entre:
//   · Producción (Cloudflare Workers): fetch() con Upgrade
//     websocket (permite cabeceras custom) → resp.webSocket.
//   · Desarrollo (mini-service con el paquete `ws`).
//
// Este módulo no conoce el transporte: la sesión se ejecuta
// sobre una interfaz de socket mínima (EdgeSocket).
// ============================================================

import { generateSecMsGecV2, EDGE_TRUSTED_CLIENT_TOKEN } from "./edge-drm"

const SEC_MS_GEC_VERSION = "2-143.0.3650.75"
const EDGE_TTS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
const EDGE_TTS_ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"

/** Límite de bytes por mensaje SSML (igual que la implementación de referencia). */
const SSML_MAX_BYTES = 4096

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

/** Fecha en el formato que espera el servicio (estilo JS Date en UTC). */
export function wsDateString(): string {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const d = new Date()
  const p2 = (n: number) => String(n).padStart(2, "0")
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`
}

/** Id aleatorio de 32 hex (sin guiones). */
export function connectId(): string {
  return crypto.randomUUID().replace(/-/g, "")
}

/** Cookie muid aleatoria (32 hex mayúsculas), como el cliente oficial. */
export function muidCookie(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  const muid = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()
  return `muid=${muid};`
}

/** Cabeceras HTTP obligatorias del handshake (verificado empíricamente). */
export function edgeHandshakeHeaders(): Record<string, string> {
  return {
    Origin: EDGE_TTS_ORIGIN,
    "User-Agent": EDGE_TTS_UA,
    Cookie: muidCookie(),
  }
}

/** URL de conexión con token DRM fresco. `https` para fetch-upgrade, `wss` para ws. */
export function buildEdgeUrl(scheme: "https" | "wss", skewSeconds = 0): string {
  const gec = generateSecMsGecV2(Date.now() / 1000 + skewSeconds)
  const params = new URLSearchParams({
    TrustedClientToken: EDGE_TRUSTED_CLIENT_TOKEN,
    ConnectionId: connectId(),
    "Sec-MS-GEC": gec,
    "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
  })
  return `${scheme}://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${params.toString()}`
}

/** Caracteres de control incompatibles con el servicio → espacio. */
export function removeIncompatibleCharacters(text: string): string {
  let out = ""
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 32
    out += (code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) ? " " : ch
  }
  return out
}

/** Escape XML para incrustar el texto en el SSML. */
export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;")
}

/**
 * Trocea texto (ya escapado) en piezas de ≤ maxBytes UTF-8,
 * cortando por saltos de línea o espacios y sin romper
 * entidades XML ni caracteres multi-byte.
 */
export function splitTextByByteLength(text: string, maxBytes = SSML_MAX_BYTES): string[] {
  const encoder = new TextEncoder()
  const chunks: string[] = []

  const bytes = encoder.encode(text)
  if (bytes.length <= maxBytes) {
    const whole = text.trim()
    return whole ? [whole] : []
  }

  let textRest = text
  while (encoder.encode(textRest).length > maxBytes) {
    const restBytes = encoder.encode(textRest)
    // último \n o espacio dentro del límite
    let splitAt = -1
    for (let i = maxBytes; i >= 0; i--) {
      const ch = textRest.codePointAt(i)
      if (ch === 10 || ch === 32) {
        splitAt = i
        break
      }
    }
    if (splitAt < 0) {
      // punto seguro UTF-8: avanzar mientras el byte no sea continuación (0b10xxxxxx)
      splitAt = maxBytes
      while (splitAt > 0 && (restBytes[splitAt]! & 0xc0) === 0x80) splitAt--
    }
    // no cortar dentro de una entidad XML (&...; sin cerrar)
    while (splitAt > 0) {
      const amp = textRest.lastIndexOf("&", splitAt)
      if (amp === -1 || textRest.indexOf(";", amp) !== -1 && textRest.indexOf(";", amp) < splitAt) break
      splitAt = amp
    }
    if (splitAt <= 0) break
    const chunk = textRest.slice(0, splitAt).trim()
    if (chunk) chunks.push(chunk)
    textRest = textRest.slice(splitAt)
  }
  const rest = textRest.trim()
  if (rest) chunks.push(rest)
  return chunks
}

/** Nombre largo de voz que exige el servicio en el SSML. */
export function longVoiceName(voiceId: string): string {
  const m = /^([a-z]{2})-([A-Z]{2})-(.+)$/.exec(voiceId)
  if (!m) return voiceId
  return `Microsoft Server Speech Text to Speech Voice (${m[1]}-${m[2]}, ${m[3]})`
}

/** Mensaje speech.config (metadatos desactivados: solo queremos audio). */
export function buildSpeechConfig(): string {
  return (
    `X-Timestamp:${wsDateString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
  )
}

export type EdgeProsody = {
  /** porcentaje de velocidad, p. ej. -50..100 → "-20%" */
  ratePct: number
  /** hercios de tono, p. ej. -50..50 → "+10Hz" */
  pitchHz: number
  /** porcentaje de volumen, p. ej. -50..50 → "+0%" */
  volumePct: number
}

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`
const fmtHz = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}Hz`

/** Mensaje SSML con cabeceras del protocolo. */
export function buildSsmlMessage(voiceId: string, escapedText: string, prosody: EdgeProsody): string {
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-MX'>` +
    `<voice name='${longVoiceName(voiceId)}'>` +
    `<prosody pitch='${fmtHz(prosody.pitchHz)}' rate='${fmtPct(prosody.ratePct)}' volume='${fmtPct(prosody.volumePct)}'>` +
    `${escapedText}` +
    `</prosody></voice></speak>`
  return (
    `X-RequestId:${connectId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${wsDateString()}Z\r\nPath:ssml\r\n\r\n${ssml}`
  )
}

/**
 * Extrae el audio de un frame binario del servicio:
 * [2 bytes BE de longitud de cabecera][cabecera][mp3].
 */
export function extractAudioFrame(data: ArrayBuffer): Uint8Array | null {
  const buf = new Uint8Array(data)
  if (buf.length < 2) return null
  const headerLen = (buf[0]! << 8) | buf[1]!
  if (headerLen + 2 >= buf.length) return null
  return buf.slice(2 + headerLen)
}

// ------------------------------------------------------------
// Sesión de síntesis (transporte-agnóstico)
// ------------------------------------------------------------

/** Socket mínimo que debe proveer cada transporte. */
export interface EdgeSocket {
  send(data: string): void
  close(): void
  onText(cb: (data: string) => void): void
  onBinary(cb: (data: ArrayBuffer) => void): void
  onError(cb: (err: unknown) => void): void
  onClose(cb: (code: number, reason: string) => void): void
}

export type EdgeSynthParams = {
  text: string
  voiceId: string
  prosody: EdgeProsody
  timeoutMs?: number
}

/**
 * Sintetiza un texto completo abriendo una conexión por trozo
 * (comportamiento de la implementación de referencia) y
 * concatenando el MP3 resultante.
 */
export async function synthesizeEdge(
  connect: () => Promise<EdgeSocket>,
  params: EdgeSynthParams
): Promise<Uint8Array> {
  const escaped = xmlEscape(removeIncompatibleCharacters(params.text))
  const chunks = splitTextByByteLength(escaped)
  if (chunks.length === 0) throw new Error("empty-text")

  const parts: Uint8Array[] = []
  for (const chunk of chunks) {
    parts.push(await synthesizeOneChunk(connect, chunk, params))
  }
  const total = parts.reduce((acc, p) => acc + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/** Una conexión = un trozo de texto. Devuelve el MP3 del trozo. */
async function synthesizeOneChunk(
  connect: () => Promise<EdgeSocket>,
  chunk: string,
  params: EdgeSynthParams
): Promise<Uint8Array> {
  const sock = await connect()
  return new Promise<Uint8Array>((resolve, reject) => {
    const audio: Uint8Array[] = []
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      try {
        sock.close()
      } catch {
        /* noop */
      }
      fn()
    }
    const timer = setTimeout(() => finish(() => reject(new EdgeTtsError("timeout", 504))), params.timeoutMs ?? 45_000)

    sock.onError(() => finish(() => reject(new EdgeTtsError("connection", 502))))
    sock.onClose((code) => finish(() => reject(new EdgeTtsError(`closed-${code}`, 502))))
    sock.onBinary((data) => {
      const frame = extractAudioFrame(data)
      if (frame && frame.length > 0) audio.push(frame)
    })
    sock.onText((data) => {
      if (data.includes("Path:turn.end")) {
        clearTimeout(timer)
        finish(() => {
          if (audio.length === 0) {
            reject(new EdgeTtsError("no-audio", 502))
            return
          }
          const total = audio.reduce((acc, a) => acc + a.length, 0)
          const out = new Uint8Array(total)
          let off = 0
          for (const a of audio) {
            out.set(a, off)
            off += a.length
          }
          resolve(out)
        })
      }
    })

    // Orden del protocolo: primero config, luego SSML.
    sock.send(buildSpeechConfig())
    sock.send(buildSsmlMessage(params.voiceId, chunk, params.prosody))
  })
}

/** Error con código HTTP sugerido. */
export class EdgeTtsError extends Error {
  constructor(
    public readonly reason: string,
    public readonly status: number
  ) {
    super(`EdgeTtsError: ${reason}`)
    this.name = "EdgeTtsError"
  }
}

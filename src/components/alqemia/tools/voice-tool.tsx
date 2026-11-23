"use client"

// ============================================================
// LA VOZ DEL ALQUIMISTA — Generador de voz IA
// Escribe un texto, elige entre 20+ voces (motor Google gratis
// + voces de la casa premium), genera el audio y descárgalo en
// MP3 o WAV. 100% gratuito, sin API keys.
// ============================================================

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AudioLines, Download, Info, Loader2, Mic } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { TTS_VOICES, type TtsEngine, type TtsVoice } from "@/lib/types"
import { cn } from "@/lib/utils"

const GOOGLE_VOICES = TTS_VOICES.filter((voice) => voice.engine === "google")
const CASA_VOICES = TTS_VOICES.filter((voice) => voice.engine === "casa")

const GOOGLE_MAX_CHARS = 3000
const CASA_MAX_CHARS = 1024

type AudioResult = {
  url: string
  engine: TtsEngine
}

/** Chip individual del catálogo de voces. */
function VoiceChip({
  voice,
  selected,
  onSelect,
}: {
  voice: TtsVoice
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
        selected
          ? "border-gold bg-gold/10 text-gold-bright"
          : "border-zinc-800 text-zinc-300 hover:border-gold/40"
      )}
    >
      <span className="flex w-full items-center gap-1.5">
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            selected ? "bg-gold/20 text-gold-bright" : "bg-zinc-900 text-zinc-500"
          )}
        >
          {voice.flag}
        </span>
        <span className="truncate text-xs font-semibold">{voice.label}</span>
      </span>
      <span className="w-full truncate text-[10px] text-zinc-500">{voice.desc}</span>
    </button>
  )
}

export function VoiceTool() {
  const [text, setText] = useState("")
  const [voiceId, setVoiceId] = useState("es")
  const [speed, setSpeed] = useState(1)
  const [isPending, setIsPending] = useState(false)
  const [audio, setAudio] = useState<AudioResult | null>(null)

  const audioUrlRef = useRef<string | null>(null)

  // Liberar el último blob URL al desmontar la herramienta.
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const selectedVoice = TTS_VOICES.find((v) => v.id === voiceId) ?? TTS_VOICES[0]
  const isCasa = selectedVoice.engine === "casa"
  const maxChars = isCasa ? CASA_MAX_CHARS : GOOGLE_MAX_CHARS
  const overLimit = text.length > maxChars
  const canGenerate = text.trim().length > 0 && !overLimit && !isPending

  const releaseAudioUrl = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }

  async function generate() {
    if (!canGenerate) return
    setIsPending(true)
    try {
      const res = await fetch("/api/tools/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice: voiceId,
          speed: isCasa ? speed : 1,
        }),
      })

      if (!res.ok) {
        let message = "El generador de voz no está disponible. Intenta de nuevo."
        try {
          const data = (await res.json()) as { error?: string }
          if (data && typeof data.error === "string" && data.error) message = data.error
        } catch {
          // Respuesta sin cuerpo JSON: mantenemos el mensaje por defecto.
        }
        toast.error(message)
        return
      }

      const blob = await res.blob()
      releaseAudioUrl()
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      setAudio({ url, engine: selectedVoice.engine })
      toast.success("Audio generado. Escúchalo y descárgalo.")
    } catch {
      toast.error("No se pudo generar el audio. Revisa tu conexión e intenta de nuevo.")
    } finally {
      setIsPending(false)
    }
  }

  function clearAudio() {
    releaseAudioUrl()
    setAudio(null)
  }

  return (
    <Card className="flex h-full flex-col gap-0 rounded-2xl border-zinc-800 bg-zinc-950 p-5 sm:p-6">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
          <Mic className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-none text-zinc-100">
            Voz del Alquimista
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Escribe el texto, elige la voz y descarga tu audio en MP3. 100% gratuito.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {/* Texto a convertir */}
        <div className="space-y-1.5">
          <Label htmlFor="vt-text" className="text-xs text-zinc-500">
            Texto a convertir
          </Label>
          <Textarea
            id="vt-text"
            rows={5}
            placeholder="Escribe aquí lo que quieres que la voz diga…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="resize-none border-zinc-800 bg-zinc-950/70 focus-visible:border-gold/50 focus-visible:ring-gold/25"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-600">
              {isCasa ? `Las voces de la casa admiten hasta ${CASA_MAX_CHARS} caracteres` : ""}
            </span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                overLimit ? "font-semibold text-red-400" : "text-zinc-600"
              )}
            >
              {text.length} / {maxChars}
            </span>
          </div>
        </div>

        {/* Catálogo de voces */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-500">Elige la voz</Label>
          <div className="thin-scrollbar max-h-56 overflow-y-auto rounded-xl border border-zinc-800 p-3">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Motor Google · Gratis
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GOOGLE_VOICES.map((voice) => (
                <VoiceChip
                  key={voice.id}
                  voice={voice}
                  selected={voice.id === voiceId}
                  onSelect={() => setVoiceId(voice.id)}
                />
              ))}
            </div>
            <p className="mt-4 px-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Voces de la casa · Premium
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CASA_VOICES.map((voice) => (
                <VoiceChip
                  key={voice.id}
                  voice={voice}
                  selected={voice.id === voiceId}
                  onSelect={() => setVoiceId(voice.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Velocidad (solo voces de la casa) */}
        {isCasa ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-500">Velocidad</Label>
              <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gold-bright">
                x{speed.toFixed(1)}
              </span>
            </div>
            <Slider
              min={0.5}
              max={2}
              step={0.1}
              value={[speed]}
              onValueChange={(v) => setSpeed(v[0] ?? 1)}
              aria-label="Velocidad de la voz"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>0.5 lento</span>
              <span>2.0 rápido</span>
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-zinc-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            El control de velocidad está disponible en las voces de la casa
          </p>
        )}

        {/* Generar */}
        <Button
          type="button"
          className="btn-gold h-11 w-full font-semibold sm:w-auto"
          disabled={!canGenerate}
          onClick={() => void generate()}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <AudioLines className="h-4 w-4" aria-hidden />
          )}
          {isPending ? "Generando audio…" : "Generar voz"}
        </Button>
      </div>

      {/* Resultado */}
      {audio && (
        <div className="animate-view mt-5 space-y-3 rounded-xl border border-gold/25 bg-gold/5 p-4">
          <audio controls src={audio.url} className="w-full">
            Tu navegador no soporta la reproducción de audio.
          </audio>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className="h-10 flex-1 border-gold/40 bg-transparent font-semibold text-gold-bright hover:bg-gold/10 hover:text-gold-bright"
            >
              <a
                href={audio.url}
                download={`voz-alqemia.${audio.engine === "casa" ? "wav" : "mp3"}`}
              >
                <Download className="h-4 w-4" aria-hidden />
                Descargar {audio.engine === "casa" ? "WAV" : "MP3"}
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 text-zinc-400 hover:text-zinc-100"
              onClick={clearAudio}
            >
              Limpiar
            </Button>
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <p className="mt-5 flex items-start gap-2 rounded-xl bg-zinc-900/60 px-3.5 py-3 text-[11px] leading-relaxed text-zinc-500 ring-1 ring-inset ring-zinc-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          La clonación de voz humana requiere servicios de pago. El Arsenal solo integra
          motores 100% gratuitos, sin API keys.
        </span>
      </p>
    </Card>
  )
}

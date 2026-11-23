"use client"

// ============================================================
// LA VOZ DEL ALQUIMISTA — Generador de voz IA
// 40 voces neuronales en español con acentos de TODA
// Latinoamérica (México, Colombia, Argentina, Perú, Venezuela,
// Caribe, Centroamérica…). 100% gratuito y descargable en MP3.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AudioLines, Download, Info, Loader2, Mic } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { TTS_COUNTRIES, type TtsVoiceGender, type TtsVoiceRegion } from "@/lib/types"
import { cn } from "@/lib/utils"

const MAX_CHARS = 3000

const REGION_ORDER: TtsVoiceRegion[] = ["Norteamérica", "Centroamérica", "Caribe", "Sudamérica"]

const COUNTRIES_BY_REGION = REGION_ORDER.map((region) => ({
  region,
  countries: TTS_COUNTRIES.filter((c) => c.region === region),
}))

type AudioResult = {
  url: string
  fileName: string
}

export function VoiceTool() {
  const [text, setText] = useState("")
  const [countryCc, setCountryCc] = useState("MX")
  const [gender, setGender] = useState<TtsVoiceGender>("F")
  const [rate, setRate] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [isPending, setIsPending] = useState(false)
  const [audio, setAudio] = useState<AudioResult | null>(null)

  const audioUrlRef = useRef<string | null>(null)

  const country = useMemo(
    () => TTS_COUNTRIES.find((c) => c.cc === countryCc) ?? TTS_COUNTRIES[0]!,
    [countryCc]
  )
  const voice = useMemo(
    () => country.voices.find((v) => v.gender === gender) ?? country.voices[0]!,
    [country, gender]
  )

  // Liberar el último blob URL al desmontar la herramienta.
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const overLimit = text.length > MAX_CHARS
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
          voice: voice.id,
          rate,
          pitch,
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
      const slug = voice.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
      setAudio({ url, fileName: `voz-alqemia-${slug}-${country.cc.toLowerCase()}.mp3` })
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
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-lg font-semibold leading-none text-zinc-100">
              Voz del Alquimista
            </h2>
            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-bright ring-1 ring-inset ring-gold/25">
              40 voces · 20 países
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Voces neuronales en español con acentos de toda Latinoamérica. Gratis y descargable.
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
          <div className="flex justify-end">
            <span
              className={cn(
                "text-[11px] tabular-nums",
                overLimit ? "font-semibold text-red-400" : "text-zinc-600"
              )}
            >
              {text.length} / {MAX_CHARS}
            </span>
          </div>
        </div>

        {/* País / acento */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vt-country" className="text-xs text-zinc-500">
              País / acento
            </Label>
            <Select value={countryCc} onValueChange={setCountryCc}>
              <SelectTrigger
                id="vt-country"
                className="w-full border-zinc-800 bg-zinc-950/70 focus-visible:ring-gold/25"
                aria-label="Selecciona el país del acento"
              >
                <SelectValue placeholder="Selecciona un país" />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-zinc-800 bg-zinc-950">
                {COUNTRIES_BY_REGION.map(({ region, countries }) => (
                  <SelectGroup key={region}>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/60">
                      {region}
                    </SelectLabel>
                    {countries.map((c) => (
                      <SelectItem
                        key={c.cc}
                        value={c.cc}
                        className="text-zinc-300 focus:bg-gold/10 focus:text-gold-bright"
                      >
                        {c.country}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voz (mujer/hombre) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Voz</Label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Selecciona la voz">
              {country.voices.map((v) => {
                const selected = v.gender === gender
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setGender(v.gender)}
                    aria-pressed={selected}
                    className={cn(
                      "flex min-h-[40px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
                      selected
                        ? "border-gold bg-gold/10 text-gold-bright"
                        : "border-zinc-800 text-zinc-300 hover:border-gold/40"
                    )}
                  >
                    <span className="text-sm font-semibold leading-none">{v.name}</span>
                    <span
                      className={cn(
                        "mt-1 text-[10px] font-medium uppercase tracking-wide",
                        selected ? "text-gold/80" : "text-zinc-500"
                      )}
                    >
                      {v.gender === "F" ? "Mujer" : "Hombre"}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Velocidad */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Velocidad</Label>
            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gold-bright">
              {rate > 0 ? `+${rate}%` : `${rate}%`}
            </span>
          </div>
          <Slider
            min={-50}
            max={50}
            step={5}
            value={[rate]}
            onValueChange={(v) => setRate(v[0] ?? 0)}
            aria-label="Velocidad de la voz"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>-50% lento</span>
            <span>+50% rápido</span>
          </div>
        </div>

        {/* Tono */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Tono</Label>
            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gold-bright">
              {pitch > 0 ? `+${pitch} Hz` : `${pitch} Hz`}
            </span>
          </div>
          <Slider
            min={-50}
            max={50}
            step={5}
            value={[pitch]}
            onValueChange={(v) => setPitch(v[0] ?? 0)}
            aria-label="Tono de la voz"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>-50 Hz grave</span>
            <span>+50 Hz agudo</span>
          </div>
        </div>

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
          {isPending ? "Generando audio…" : `Generar voz de ${voice.name}`}
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
              <a href={audio.url} download={audio.fileName}>
                <Download className="h-4 w-4" aria-hidden />
                Descargar MP3
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
          Voces neuronales de máxima calidad (motor gratuito de Microsoft Edge, sin API keys
          ni límites de pago). La clonación de voz humana requiere servicios de pago: el Arsenal
          solo integra motores 100% gratuitos.
        </span>
      </p>
    </Card>
  )
}

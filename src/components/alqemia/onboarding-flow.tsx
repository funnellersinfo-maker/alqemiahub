"use client"

// ============================================================
// ALQEMIA — Onboarding gamificado
// 3 pasos: avatar → especialidades (varias) → objetivos (varios).
// Guarda headline = especialidades.join(" · ") y goal = objetivos.join(" · ")
// ============================================================

import { useState, type ChangeEvent, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, Check, Loader2, Zap } from "lucide-react"
import { toast } from "sonner"

import { AVATAR_COLORS, UserAvatar } from "@/components/alqemia/avatar"
import { LevelBadge } from "@/components/alqemia/level-badge"
import { AlchemyBackground } from "@/components/alqemia/fx/alchemy-background"
import { CountUp, SparkleBurst } from "@/components/alqemia/fx/celebration"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { useMe } from "@/hooks/use-me"
import { celebrateXp } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { ApiErrorShape, MeResponse } from "@/lib/types"

const SPECIALTIES = [
  "Ecommerce",
  "Marketing digital",
  "Meta Ads",
  "Copywriting",
  "Contenido",
  "Branding",
  "Afiliación",
  "Freelance",
  "Agencia",
  "Emprendedor",
]

const GOALS = [
  "Lanzar mi primera tienda",
  "Escalar mi negocio",
  "Aprender marketing desde cero",
  "Crear mi marca personal",
  "Generar ingresos online",
]

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const MAX_DATAURL_LENGTH = 240_000

// ----------------------------------------------------------------
// Procesamiento de imagen de avatar (recorte cuadrado + JPEG)
// ----------------------------------------------------------------
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"))
    img.src = src
  })
}

/** Recorta a un cuadrado centrado (cover) y comprime a 256x256 JPEG para el avatar. */
async function squareAvatarDataUrl(file: File): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(rawDataUrl)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas no disponible")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, 256, 256)
  ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256)
  let dataUrl = canvas.toDataURL("image/jpeg", 0.85)
  if (dataUrl.length > MAX_DATAURL_LENGTH) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.6)
  }
  return dataUrl
}

function initialOf(name: string): string {
  const ch = name.trim().charAt(0)
  return (ch || "A").toUpperCase()
}

// Chip de selección múltiple con check + pop al activarse
function SelectChip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:scale-95",
        selected
          ? "animate-chip-pop border-gold-deep bg-gold/10 text-gold-bright shadow-[0_0_18px_-6px_rgba(217,164,65,0.55)]"
          : "border-zinc-800 text-zinc-400 hover:border-gold/40 hover:text-zinc-200"
      )}
    >
      <Check
        className={cn(
          "h-3.5 w-3.5 transition-all duration-200",
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

// Contador de selección ("3 seleccionadas")
function SelectionCounter({ count, singular, plural }: { count: number; singular: string; plural: string }) {
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-300",
        count > 0
          ? "animate-chip-pop border-gold/40 bg-gold/10 text-gold-bright"
          : "border-zinc-800 text-zinc-500"
      )}
    >
      {count > 0 ? `${count} ${count === 1 ? singular : plural}` : "Ninguna aún"}
    </span>
  )
}

// Navegación inferior de cada paso del wizard
function WizardNav({
  showBack,
  onBack,
  children,
}: {
  showBack: boolean
  onBack?: () => void
  children: ReactNode
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {showBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          Atrás
        </Button>
      ) : (
        <span className="hidden sm:inline-block" aria-hidden="true" />
      )}
      {children}
    </div>
  )
}

export function OnboardingFlow({ onComplete }: { onComplete?: () => void }) {
  const queryClient = useQueryClient()
  const { data } = useMe()
  const user = data?.user

  const [step, setStep] = useState(0)
  const [avatarColor, setAvatarColor] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [specialties, setSpecialties] = useState<string[]>([])
  const [bio, setBio] = useState("")
  const [goals, setGoals] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<MeResponse | null>(null)

  const displayName = user?.name ?? "Tu nombre"
  const effectiveColor = avatarColor ?? user?.avatarColor ?? AVATAR_COLORS[0]
  const previewImage = image ?? user?.image ?? null
  const awardedXp = result?.xp?.awarded ?? 100
  const levelInfo = result?.xp?.level ?? result?.user.level ?? user?.level ?? null

  async function handleAvatarFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("La imagen no puede superar 5 MB")
      return
    }
    setUploading(true)
    try {
      const dataUrl = await squareAvatarDataUrl(file)
      setImage(dataUrl)
    } catch {
      toast.error("No se pudo procesar la imagen")
    } finally {
      setUploading(false)
    }
  }

  function onAvatarInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleAvatarFile(file)
    e.target.value = ""
  }

  function toggleSpecialty(item: string) {
    setSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    )
  }

  function toggleGoal(item: string) {
    setGoals((prev) =>
      prev.includes(item) ? prev.filter((g) => g !== item) : [...prev, item]
    )
  }

  async function handleSubmit() {
    if (specialties.length === 0 || goals.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        headline: specialties.join(" · "),
        goal: goals.join(" · "),
        profileCompleted: true,
      }
      if (image) {
        body.image = image
      } else {
        body.avatarColor = effectiveColor
      }
      const bioTrimmed = bio.trim()
      if (bioTrimmed) body.bio = bioTrimmed

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as ApiErrorShape | null
        toast.error(errorData?.error ?? "No se pudo guardar tu perfil. Intenta de nuevo")
        return
      }
      const data = (await res.json()) as MeResponse
      celebrateXp(data.xp ?? null)
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      setResult(data)
      setStep(3)
    } catch {
      toast.error("No se pudo guardar tu perfil. Intenta de nuevo")
    } finally {
      setSubmitting(false)
    }
  }

  const progressValue = step >= 3 ? 100 : (step / 3) * 100

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-zinc-950 p-4 sm:p-6">
      {/* Fondo vivo */}
      <AlchemyBackground density={0.7} />

      {/* Marca */}
      <div className="animate-fade-up relative z-10 flex flex-col items-center text-center">
        <img
          src="/images/logo-mark.png"
          alt="Logotipo de ALQEMIA"
          className="h-10 w-10 rounded-xl shadow-[0_0_28px_-4px_rgba(217,164,65,0.5)]"
        />
        <span className="brand-wordmark mt-3 pl-[0.38em] text-sm">ALQEMIA</span>
        <h1 className="font-display mt-3 text-2xl tracking-tight text-zinc-100 sm:text-3xl">
          Completa tu perfil
        </h1>
        <p className="mt-2 text-sm text-zinc-500">3 pasos para desbloquear tu +100 XP</p>
      </div>

      <Card className="gate-card animate-fade-up relative z-10 mt-8 w-full max-w-xl gap-0 rounded-2xl border-0 p-6 [animation-delay:0.15s] sm:p-8">
        <span className="text-xs text-zinc-500">
          {step >= 3 ? "Perfil completo" : `Paso ${step + 1} de 3`}
        </span>
        <Progress
          value={progressValue}
          className="mt-2 [&>div]:bg-gradient-to-r [&>div]:from-gold [&>div]:to-gold-deep"
        />

        <div key={step} className="animate-view mt-8">
          {step === 0 && (
            <div>
              <h2 className="font-display text-lg tracking-tight text-zinc-100">Tu avatar</h2>
              <p className="mt-1 text-sm text-zinc-500">¿Cómo te verá la comunidad?</p>

              <div className="mt-6 flex flex-col items-center">
                <div className="animate-chip-pop" key={previewImage ?? effectiveColor}>
                  <UserAvatar
                    user={{ name: displayName, image: previewImage, avatarColor: effectiveColor }}
                    size="2xl"
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-100">{displayName}</p>
                <p className="text-xs text-zinc-500">{user?.email ?? ""}</p>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {AVATAR_COLORS.map((color, index) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    disabled={uploading}
                    aria-label={`Elegir color de avatar ${index + 1}`}
                    aria-pressed={effectiveColor === color}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-60",
                      effectiveColor === color &&
                        "animate-chip-pop ring-2 ring-gold-deep ring-offset-2 ring-offset-zinc-950"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {initialOf(displayName)}
                  </button>
                ))}
              </div>

              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarInputChange}
              />
              <label
                htmlFor="avatar-upload"
                className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 p-3 text-sm text-zinc-400 transition-colors hover:border-gold/50 hover:text-zinc-200"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden="true" />
                )}
                {uploading ? "Procesando imagen..." : "Subir foto"}
              </label>

              <WizardNav showBack={false}>
                <Button
                  type="button"
                  className="btn-gold w-full font-semibold sm:w-auto"
                  disabled={uploading}
                  onClick={() => setStep(1)}
                >
                  Continuar
                </Button>
              </WizardNav>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg tracking-tight text-zinc-100">
                  Tus especialidades
                </h2>
                <SelectionCounter count={specialties.length} singular="elegida" plural="elegidas" />
              </div>
              <p className="mt-1 text-sm text-zinc-500">¿A qué te dedicas? Elige todas las que apliquen.</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {SPECIALTIES.map((item) => (
                  <SelectChip
                    key={item}
                    label={item}
                    selected={specialties.includes(item)}
                    onToggle={() => toggleSpecialty(item)}
                  />
                ))}
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="onboarding-bio">Cuéntale a la comunidad quién eres (opcional)</Label>
                  <span className="shrink-0 text-xs text-zinc-400">{bio.length}/500</span>
                </div>
                <Textarea
                  id="onboarding-bio"
                  rows={3}
                  maxLength={500}
                  placeholder="Ej. Gestor de tiendas Shopify enamorado del copywriting..."
                  className="mt-2 resize-none border-zinc-800 bg-zinc-950/70 focus-visible:border-gold/50 focus-visible:ring-gold/25"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <WizardNav showBack onBack={() => setStep(0)}>
                <Button
                  type="button"
                  className="btn-gold w-full font-semibold sm:w-auto"
                  disabled={specialties.length === 0}
                  onClick={() => setStep(2)}
                >
                  Continuar ({specialties.length})
                </Button>
              </WizardNav>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg tracking-tight text-zinc-100">Tus objetivos</h2>
                <SelectionCounter count={goals.length} singular="elegido" plural="elegidos" />
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                ¿Qué quieres lograr? Elige todos los que quieras perseguir.
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Los usaremos para recomendarte programas
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {GOALS.map((item) => (
                  <SelectChip
                    key={item}
                    label={item}
                    selected={goals.includes(item)}
                    onToggle={() => toggleGoal(item)}
                  />
                ))}
              </div>

              <WizardNav showBack onBack={() => setStep(1)}>
                <Button
                  type="button"
                  className="btn-gold w-full font-semibold sm:w-auto"
                  disabled={goals.length === 0 || submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Zap aria-hidden="true" />
                  )}
                  Completar perfil
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-bold">
                    +100 XP
                  </span>
                </Button>
              </WizardNav>
            </div>
          )}

          {step >= 3 && (
            <div className="relative flex flex-col items-center py-4 text-center">
              <SparkleBurst count={20} distance={104} />
              <div className="animate-portal-in relative flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 shadow-[0_0_50px_-6px_rgba(217,164,65,0.6)] ring-1 ring-gold/40">
                <Zap className="h-10 w-10 fill-gold text-gold-deep" aria-hidden="true" />
              </div>
              <p className="font-display animate-fade-up mt-6 text-5xl font-bold tracking-tight [animation-delay:0.1s]">
                <span className="gold-text">
                  +<CountUp value={awardedXp} /> XP
                </span>
              </p>
              <h2 className="font-display animate-fade-up mt-2 text-xl tracking-tight text-zinc-100 [animation-delay:0.25s]">
                Perfil Transmutado
              </h2>
              {levelInfo && (
                <div className="animate-fade-up mt-3 [animation-delay:0.4s]">
                  <LevelBadge level={levelInfo} />
                </div>
              )}
              <p className="animate-fade-up mt-4 max-w-sm text-sm text-zinc-500 [animation-delay:0.5s]">
                Ya eres parte del gremio. Tu progreso queda registrado para el ranking.
              </p>
              <Button
                type="button"
                size="lg"
                className="btn-gold animate-fade-up mt-8 px-8 font-semibold [animation-delay:0.6s]"
                onClick={() => onComplete?.()}
              >
                Entrar al Hub
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

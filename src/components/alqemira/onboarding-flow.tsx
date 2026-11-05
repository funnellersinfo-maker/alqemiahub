"use client"

import { useState, type ChangeEvent, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, Loader2, Zap } from "lucide-react"
import { toast } from "sonner"

import { AVATAR_COLORS, UserAvatar } from "@/components/alqemira/avatar"
import { LevelBadge } from "@/components/alqemira/level-badge"
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

const CHIP_CLASSES =
  "rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"

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
  const [goal, setGoal] = useState<string | null>(null)
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

  async function handleSubmit() {
    if (specialties.length === 0 || !goal || submitting) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        headline: specialties.join(" · "),
        goal,
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 p-4 sm:p-6">
      {/* Marca */}
      <div className="flex flex-col items-center text-center">
        { }
        <img
          src="/images/logo-mark.png"
          alt="Logotipo de ALQEMIRA"
          className="h-10 w-10 rounded-xl shadow"
        />
        <span className="gold-text mt-3 font-display text-lg tracking-tight">ALQEMIRA</span>
        <h1 className="font-display mt-3 text-2xl tracking-tight text-zinc-900 sm:text-3xl">
          Completa tu perfil
        </h1>
        <p className="mt-2 text-sm text-zinc-500">3 pasos para desbloquear tu +100 XP</p>
      </div>

      <Card className="mt-8 w-full max-w-xl gap-0 rounded-2xl p-6 sm:p-8">
        <span className="text-xs text-zinc-500">
          {step >= 3 ? "Perfil completo" : `Paso ${step + 1} de 3`}
        </span>
        <Progress
          value={progressValue}
          className="mt-2 [&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-amber-500"
        />

        <div key={step} className="animate-view mt-8">
          {step === 0 && (
            <div>
              <h2 className="font-display text-lg tracking-tight text-zinc-900">Tu avatar</h2>
              <p className="mt-1 text-sm text-zinc-500">¿Cómo te verá la comunidad?</p>

              <div className="mt-6 flex flex-col items-center">
                <UserAvatar
                  user={{ name: displayName, image: previewImage, avatarColor: effectiveColor }}
                  size="2xl"
                />
                <p className="mt-3 text-sm font-medium text-zinc-900">{displayName}</p>
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
                      "flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-60",
                      effectiveColor === color && "ring-2 ring-amber-500 ring-offset-2"
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
                className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
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
                  className="w-full sm:w-auto"
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
              <h2 className="font-display text-lg tracking-tight text-zinc-900">Tu especialidad</h2>
              <p className="mt-1 text-sm text-zinc-500">¿A qué te dedicas?</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Elige una o varias (aparecerán en tu perfil)
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {SPECIALTIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleSpecialty(item)}
                    aria-pressed={specialties.includes(item)}
                    className={cn(
                      CHIP_CLASSES,
                      specialties.includes(item)
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    )}
                  >
                    {item}
                  </button>
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
                  className="mt-2 resize-none"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <WizardNav showBack onBack={() => setStep(0)}>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={specialties.length === 0}
                  onClick={() => setStep(2)}
                >
                  Continuar
                </Button>
              </WizardNav>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-lg tracking-tight text-zinc-900">Tu objetivo</h2>
              <p className="mt-1 text-sm text-zinc-500">¿Qué quieres lograr primero?</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Lo usaremos para recomendarte programas
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {GOALS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setGoal(item)}
                    aria-pressed={goal === item}
                    className={cn(
                      CHIP_CLASSES,
                      goal === item
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <WizardNav showBack onBack={() => setStep(1)}>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={!goal || submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Zap className="text-amber-400" aria-hidden="true" />
                  )}
                  Completar perfil
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
                    +100 XP
                  </span>
                </Button>
              </WizardNav>
            </div>
          )}

          {step >= 3 && (
            <div className="flex flex-col items-center text-center">
              <div className="animate-logo-glow flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
                <Zap className="h-10 w-10 text-amber-500" aria-hidden="true" />
              </div>
              <p className="font-display mt-6 text-4xl font-bold text-amber-500">+{awardedXp} XP</p>
              <h2 className="font-display mt-2 text-xl tracking-tight text-zinc-900">
                Perfil Transmutado
              </h2>
              {levelInfo && (
                <div className="mt-3">
                  <LevelBadge level={levelInfo} />
                </div>
              )}
              <p className="mt-4 text-sm text-zinc-500">
                Ya eres parte del gremio. Tu progreso queda registrado para el ranking.
              </p>
              <Button type="button" size="lg" className="mt-8" onClick={() => onComplete?.()}>
                Entrar al Hub
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

"use client"

// ============================================================
// ALQEMIA — El Códice del Alquimista (educación en el registro)
// Apenas el prospecto sella su invitación, aprende en 4 lecciones
// de 20 segundos qué es el XP, cómo sube de ranking y qué mapa
// le espera dentro. Al final: desbloqueo dopaminérgico del acceso.
// ============================================================

import { useEffect, useState } from "react"
import {
  Crown,
  Footprints,
  GraduationCap,
  Home,
  KeyRound,
  Loader2,
  Map as MapIcon,
  MessageCircle,
  Radio,
  Sparkles,
  Store,
  Trophy,
  User,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { LEVELS } from "@/lib/levels"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { SparkleBurst } from "@/components/alqemia/fx/celebration"
import { cn } from "@/lib/utils"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"

const TOTAL_LESSONS = 4

const XP_CHIPS: { icon: LucideIcon; label: string; xp: number }[] = [
  { icon: MessageCircle, label: "Publicar en el Muro", xp: 15 },
  { icon: MessageCircle, label: "Comentar", xp: 5 },
  { icon: GraduationCap, label: "Completar una lección", xp: 25 },
  { icon: Trophy, label: "Dominar un programa", xp: 50 },
  { icon: Sparkles, label: "Completar tu perfil", xp: 100 },
]

const MAP_SECTIONS: { icon: LucideIcon; title: string; legend: string }[] = [
  { icon: Home, title: "El Muro", legend: "La comunidad comparte sus transmutaciones" },
  { icon: Radio, title: "En Vivo", legend: "Transmisiones en directo del maestre" },
  { icon: GraduationCap, title: "Classroom", legend: "Programas grabados, lección a lección" },
  { icon: Store, title: "Marketplace", legend: "Micro apps y productos del gremio" },
  { icon: Wrench, title: "Herramientas", legend: "Copys de élite, precios y más armas" },
  { icon: Sparkles, title: "El Oráculo", legend: "Tu consultor IA de marketing" },
  { icon: User, title: "Tu Perfil", legend: "Rango, XP, logros y ranking" },
]

export function RegisterEducation({
  name,
  onUnlock,
  unlocking,
}: {
  name: string
  onUnlock: () => void
  unlocking: boolean
}) {
  const [step, setStep] = useState(0)
  const firstName = name.split(" ")[0] || "Alquimista"
  const [burstKey, setBurstKey] = useState(0)

  // Fase final: animación de desbloqueo → cruce de la puerta
  const [unlockingLocal, setUnlockingLocal] = useState(false)

  useEffect(() => {
    if (!unlockingLocal) return
    const t = setTimeout(() => onUnlock(), 1500)
    return () => clearTimeout(t)
  }, [unlockingLocal, onUnlock])

  function handleUnlock() {
    setBurstKey((k) => k + 1)
    setUnlockingLocal(true)
  }

  const progress = Math.round((step / TOTAL_LESSONS) * 100)

  return (
    <div className="gate-card animate-fade-up thin-scrollbar max-h-[68dvh] w-full max-w-md overflow-y-auto p-5 [animation-delay:0.9s] sm:p-7">
      {/* Cabecera del códice */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          {step < TOTAL_LESSONS ? `Lección ${step + 1} de ${TOTAL_LESSONS}` : "Códice completo"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[11px] font-bold text-gold-bright">
          <MapIcon className="h-3 w-3" aria-hidden="true" />
          El Códice
        </span>
      </div>
      <Progress value={progress} className="mt-2 [&>div]:bg-gradient-to-r [&>div]:from-gold [&>div]:to-gold-deep" />

      <div key={step} className="animate-view mt-6">
        {/* ============ LECCIÓN 1 — Bienvenida ============ */}
        {step === 0 && (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
                <KeyRound className="h-5 w-5 text-gold" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg">
                  <AlqemiaLetters text={`Tu invitación fue sellada, ${firstName}`} strokeWidth={9} />
                </h2>
                <p className="text-xs text-zinc-500">Cuenta forjada · Acceso a punto de desbloquearse</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Antes de cruzar la puerta, el gremio te entrega su{" "}
              <span className="font-semibold text-gold-bright">Códice</span>: 4 lecciones de 20 segundos
              para que entiendas el juego <span className="text-zinc-200">antes</span> de jugarlo.
            </p>
            <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.06] p-3 text-xs leading-relaxed text-zinc-400">
              <span className="font-semibold text-gold-bright">La regla de oro:</span> aquí cada acción
              que emprendes se convierte en puntos, y los puntos se convierten en rango. Cuanto más
              participas, más subes. Así de simple.
            </div>
            <Button type="button" className="btn-gold mt-6 h-11 w-full font-semibold" onClick={() => setStep(1)}>
              Empezar la lección 1
            </Button>
          </div>
        )}

        {/* ============ LECCIÓN 2 — El XP ============ */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
                <Zap className="h-5 w-5 fill-gold text-gold-deep" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg"><AlqemiaLetters text="El XP: tu esencia alquímica" strokeWidth={9} /></h2>
                <p className="text-xs text-zinc-500">La moneda con la que subes de rango</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              El <span className="font-semibold text-gold-bright">XP</span> son puntos que ganas{" "}
              <span className="text-zinc-200">haciendo lo que ya harías</span>: publicar, comentar,
              estudiar. No hay trucos: participar es avanzar.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {XP_CHIPS.map((chip, i) => (
                <div
                  key={chip.label}
                  className="animate-chip-pop flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 px-2.5 py-2"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <chip.icon className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{chip.label}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-bold text-gold-bright">
                    +{chip.xp}
                  </span>
                </div>
              ))}
            </div>
            <Button type="button" className="btn-gold mt-6 h-11 w-full font-semibold" onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        )}

        {/* ============ LECCIÓN 3 — Los 8 rangos ============ */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
                <Crown className="h-5 w-5 text-gold" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg"><AlqemiaLetters text="Los 8 rangos del gremio" strokeWidth={9} /></h2>
                <p className="text-xs text-zinc-500">Todos empiezan abajo. Nadie se queda ahí.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {LEVELS.map((lvl, i) => {
                const isFirst = i === 0
                const isLast = i === LEVELS.length - 1
                return (
                  <div
                    key={lvl.level}
                    className={cn(
                      "animate-chip-pop relative flex items-center justify-between rounded-xl border px-3 py-2",
                      isFirst
                        ? "border-gold-deep bg-gold/10 shadow-[0_0_20px_-8px_rgba(217,164,65,0.6)]"
                        : isLast
                          ? "border-gold/30 bg-zinc-900"
                          : "border-zinc-800 bg-zinc-950/60"
                    )}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-sm font-semibold",
                          isFirst ? "text-gold-bright" : "text-zinc-200"
                        )}
                      >
                        {lvl.name}
                      </p>
                      <p className="text-[10px] text-zinc-500">{lvl.min} XP</p>
                    </div>
                    <span className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-zinc-400">
                      {isLast ? <Crown className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> : lvl.level}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Acumulas XP y <span className="text-zinc-200">subes de rango automáticamente</span>. Tu
              posición se ve en el <span className="font-semibold text-gold-bright">ranking del gremio</span>:
              cuanto más subes, más visibilidad ganas.
            </p>
            <Button type="button" className="btn-gold mt-5 h-11 w-full font-semibold" onClick={() => setStep(3)}>
              Continuar
            </Button>
          </div>
        )}

        {/* ============ LECCIÓN 4 — El mapa ============ */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
                <MapIcon className="h-5 w-5 text-gold" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg"><AlqemiaLetters text="El mapa del Hub" strokeWidth={9} /></h2>
                <p className="text-xs text-zinc-500">7 salas. Todas tuyas.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {MAP_SECTIONS.map((s, i) => (
                <div
                  key={s.title}
                  className="animate-chip-pop flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <s.icon className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-200">{s.title}</p>
                    <p className="truncate text-[10px] text-zinc-500">{s.legend}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" className="btn-gold mt-6 h-11 w-full font-semibold" onClick={() => setStep(4)}>
              Continuar
            </Button>
          </div>
        )}

        {/* ============ FINAL — Misión + desbloqueo ============ */}
        {step === 4 && !unlockingLocal && (
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40 shadow-[0_0_36px_-8px_rgba(217,164,65,0.7)]">
              <Footprints className="h-7 w-7 text-gold-bright" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg">
              <AlqemiaLetters text="Tu primera misión te espera" strokeWidth={9} />
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Al entrar te recibirá el <span className="font-semibold text-gold-bright">Ritual de Iniciación</span>:
              5 preguntas rápidas que te dan{" "}
              <span className="font-bold text-gold-bright">+100 XP</span> y tu primer logro.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.07] px-3.5 py-1.5 text-xs font-semibold text-gold-bright">
              <Zap className="h-3.5 w-3.5 fill-gold text-gold-deep" aria-hidden="true" />
              +100 XP = subes a Iniciado al instante
            </div>
            <Button
              type="button"
              size="lg"
              className="btn-gold mt-6 h-12 w-full px-8 text-base font-bold"
              onClick={handleUnlock}
              disabled={unlocking}
            >
              <KeyRound aria-hidden="true" />
              Desbloquear mi acceso
            </Button>
          </div>
        )}

        {/* ============ ANIMACIÓN DE DESBLOQUEO ============ */}
        {step === 4 && unlockingLocal && (
          <div className="relative flex flex-col items-center py-10 text-center" aria-live="polite">
            <SparkleBurst key={burstKey} count={30} distance={140} />
            <div className="animate-portal-in flex h-24 w-24 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40 shadow-[0_0_60px_-6px_rgba(217,164,65,0.75)]">
              {unlocking ? (
                <Loader2 className="h-11 w-11 animate-spin text-gold" aria-hidden="true" />
              ) : (
                <KeyRound className="h-11 w-11 text-gold-bright" aria-hidden="true" />
              )}
            </div>
            <div className="animate-fade-up mt-6 text-3xl [animation-delay:0.15s]">
              <AlqemiaLetters text="ACCESO CONCEDIDO" strokeWidth={8} />
            </div>
            <p className="animate-fade-up mt-2 text-sm text-zinc-500 [animation-delay:0.3s]">
              Cruzando la puerta dorada, {firstName}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

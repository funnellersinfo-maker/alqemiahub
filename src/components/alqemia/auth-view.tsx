"use client"

// ============================================================
// ALQEMIA — La Primera Puerta (AuthView)
// Entrada dopaminérgica: portal dorado orbitando, polvo de oro
// ascendente, wordmark cinético, tarjeta-puerta con borde cónico
// giratorio, botones con sheen y cinta de códice al final.
// ============================================================

import { useCallback, useState, type FormEvent } from "react"
import { signIn } from "next-auth/react"
import {
  GraduationCap,
  KeyRound,
  Loader2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AlchemyBackground } from "@/components/alqemia/fx/alchemy-background"
import { GoldenPortal } from "@/components/alqemia/fx/golden-portal"
import { KineticWordmark } from "@/components/alqemia/fx/kinetic-wordmark"
import { Marquee } from "@/components/alqemia/fx/marquee"
import { RegisterEducation } from "@/components/alqemia/register-education"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ApiErrorShape } from "@/lib/types"

// ----------------------------------------------------------------
// Logos de la escena
// ----------------------------------------------------------------

const ORBIT_CHIPS: { icon: LucideIcon; label: string; className: string; delay: string }[] = [
  { icon: Users, label: "Comunidad activa", className: "-left-48 top-4", delay: "0.6s" },
  { icon: GraduationCap, label: "Programas grabados", className: "-right-52 top-16", delay: "1.6s" },
  { icon: Wrench, label: "Herramientas IA", className: "-left-44 bottom-0", delay: "2.6s" },
]

const MARQUEE_ITEMS = [
  "TRANSMUTA CLICKS EN VENTAS",
  "COMUNIDAD · PROGRAMAS · HERRAMIENTAS",
  "EL ORO SE FORJA EN PÚBLICO",
  "NUEVO NIVEL, NUEVA ALQUIMIA",
]

const INPUT_GOLD =
  "h-11 border-zinc-800 bg-zinc-950/70 transition-all focus-visible:border-gold/50 focus-visible:ring-gold/25 focus-visible:shadow-[0_0_20px_-6px_rgba(217,164,65,0.45)]"

export function AuthView() {
  const [tab, setTab] = useState<"login" | "register">("login")

  // Login con email
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  // Registro con email + código de invitación
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regInvite, setRegInvite] = useState("")
  const [regLoading, setRegLoading] = useState(false)

  // Educación gamificada tras sellar la invitación (El Códice)
  const [education, setEducation] = useState<null | { name: string; email: string; password: string }>(null)
  const [unlocking, setUnlocking] = useState(false)

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoginLoading(true)
    try {
      const result = await signIn("credentials", {
        email: loginEmail.trim(),
        password: loginPassword,
        redirect: false,
      })
      if (result?.error) toast.error("Email o contraseña incorrectos")
      // Si el login es correcto, la sesión actualiza y el padre re-renderiza.
    } catch {
      toast.error("No se pudo iniciar sesión. Intenta de nuevo.")
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = regName.trim()
    const email = regEmail.trim()
    if (regPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (!regInvite.trim()) {
      toast.error("Ingresa tu código de invitación")
      return
    }
    setRegLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password: regPassword,
          inviteCode: regInvite.trim(),
        }),
      })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as ApiErrorShape | null
        toast.error(errorData?.error ?? "No se pudo crear tu cuenta")
        return
      }
      // Invitación sellada → El Códice educa al prospecto antes de entrar
      setEducation({ name, email, password: regPassword })
    } catch {
      toast.error("No se pudo crear tu cuenta. Intenta de nuevo.")
    } finally {
      setRegLoading(false)
    }
  }

  /** Al terminar el Códice: cruce dopaminérgico de la puerta */
  const handleUnlock = useCallback(async () => {
    if (!education) return
    setUnlocking(true)
    try {
      const result = await signIn("credentials", {
        email: education.email,
        password: education.password,
        redirect: false,
      })
      if (result?.error) {
        toast.success("Cuenta creada. Ingresa desde la pestaña Ingresar.")
        setEducation(null)
        setTab("login")
      }
      // Si el login es correcto, la sesión actualiza y el Hub toma el relevo.
    } catch {
      toast.error("No se pudo ingresar. Usa la pestaña Ingresar.")
      setEducation(null)
      setTab("login")
    } finally {
      setUnlocking(false)
    }
  }, [education])

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#050505]">
      {/* Fondo vivo: auroras + polvo de oro + retícula */}
      <AlchemyBackground density={1.15} />

      {/* ============ ESCENA ============ */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-12 pt-10 sm:pt-14">
        <div
          className={cn(
            "flex w-full flex-1 flex-col items-center justify-center",
            education ? "gap-4 sm:gap-5" : "gap-7 sm:gap-9"
          )}
        >
          {/* El Portal Dorado con chips orbitando (escena compacta durante el Códice) */}
          <div className="relative">
            <GoldenPortal size={education ? 88 : 168} />
            {!education &&
              ORBIT_CHIPS.map((chip) => (
              <div
                key={chip.label}
                aria-hidden="true"
                className={cn(
                  "animate-float absolute hidden items-center gap-2 rounded-full border border-gold/25 bg-zinc-950/85 px-4 py-2 text-xs font-medium text-zinc-300 shadow-[0_8px_30px_-10px_rgba(217,164,65,0.35)] backdrop-blur-md lg:flex",
                  chip.className
                )}
                style={{ animationDelay: chip.delay }}
              >
                <chip.icon className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                {chip.label}
              </div>
            ))}
          </div>

          {/* Wordmark cinético + promesa */}
          <div className="animate-fade-up text-center [animation-delay:0.75s]">
            <KineticWordmark className={education ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"} />
            <p
              className={cn(
                "mt-3 max-w-xs text-balance text-sm leading-relaxed text-zinc-400 sm:max-w-none",
                education ? "hidden" : "sm:text-base"
              )}
            >
              Donde el marketing se{" "}
              <span className="gold-text font-semibold">transmuta</span> en ventas
            </p>
          </div>

          {/* ============ LA PUERTA ============ */}
          {education ? (
            <RegisterEducation
              key={education.email}
              name={education.name}
              unlocking={unlocking}
              onUnlock={() => void handleUnlock()}
            />
          ) : (
          <div
            className="gate-card animate-fade-up w-full max-w-md p-5 [animation-delay:0.9s] sm:p-7"
          >
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value === "register" ? "register" : "login")}
            >
              <TabsList className="grid h-11 w-full grid-cols-2 bg-zinc-950/80">
                <TabsTrigger value="login" className="data-[state=active]:text-gold-bright">
                  Ingresar
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:text-gold-bright">
                  Crear cuenta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4 data-[state=active]:animate-view">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="tu@email.com"
                      className={cn(INPUT_GOLD, "mt-2")}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="Tu contraseña"
                      className={cn(INPUT_GOLD, "mt-2")}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="btn-gold h-11 w-full font-semibold" disabled={loginLoading}>
                    {loginLoading ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Cruzar la puerta
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4 data-[state=active]:animate-view">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="register-name">Nombre completo</Label>
                    <Input
                      id="register-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Tu nombre y apellido"
                      className={cn(INPUT_GOLD, "mt-2")}
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="tu@email.com"
                      className={cn(INPUT_GOLD, "mt-2")}
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="register-password">Contraseña</Label>
                      <span className="text-xs text-zinc-500">Mínimo 6 caracteres</span>
                    </div>
                    <Input
                      id="register-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Crea una contraseña"
                      className={cn(INPUT_GOLD, "mt-2")}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-invite" className="flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                      Código de invitación
                    </Label>
                    <Input
                      id="register-invite"
                      type="text"
                      required
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="ALQ-XXXX-XXXX"
                      className={cn(INPUT_GOLD, "mt-2 font-mono tracking-widest uppercase")}
                      value={regInvite}
                      onChange={(e) => setRegInvite(e.target.value.toUpperCase())}
                    />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                      El registro es exclusivo: tu código fue emitido por ALQEMIA para este mismo correo.
                    </p>
                  </div>
                  <Button type="submit" className="btn-gold h-11 w-full font-semibold" disabled={regLoading}>
                    {regLoading ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Sellar mi invitación
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-500">
              Al entrar aceptas las reglas del gremio.
              <br />© ALQEMIA · Marketing & Ecommerce
            </p>
          </div>
          )}
        </div>
      </main>

      {/* ============ CINTA DE CÓDICE ============ */}
      <div className="relative z-10 -mx-2 -rotate-[1.1deg]">
        <Marquee items={MARQUEE_ITEMS} />
      </div>

    </div>
  )
}

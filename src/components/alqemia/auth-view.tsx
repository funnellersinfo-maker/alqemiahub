"use client"

// ============================================================
// ALQEMIA — La Primera Puerta (AuthView)
// Entrada dopaminérgica: portal dorado orbitando, polvo de oro
// ascendente, wordmark cinético, tarjeta-puerta con borde cónico
// giratorio, botones con sheen y cinta de códice al final.
// ============================================================

import { useState, type FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import {
  GraduationCap,
  Loader2,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { GoogleDemoDialog } from "@/components/alqemia/google-demo-dialog"
import { AlchemyBackground } from "@/components/alqemia/fx/alchemy-background"
import { GoldenPortal } from "@/components/alqemia/fx/golden-portal"
import { KineticWordmark } from "@/components/alqemia/fx/kinetic-wordmark"
import { Marquee } from "@/components/alqemia/fx/marquee"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ApiErrorShape } from "@/lib/types"

// ----------------------------------------------------------------
// Estado del OAuth de Google en el servidor
// ----------------------------------------------------------------
type AuthStatusResponse = { googleConfigured: boolean }

async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch("/api/auth/status")
  if (!res.ok) throw new Error("No se pudo consultar el estado de autenticación")
  return res.json()
}

// Logo oficial de Google (marca de terceros permitida)
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

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

const DEMO_EMAIL = "valeria@alqemia.com"
const DEMO_PASSWORD = "alqemia123"

const INPUT_GOLD =
  "h-11 border-zinc-800 bg-zinc-950/70 transition-all focus-visible:border-gold/50 focus-visible:ring-gold/25 focus-visible:shadow-[0_0_20px_-6px_rgba(217,164,65,0.45)]"

function EmailDivider() {
  return (
    <div className="relative py-3" aria-hidden="true">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-zinc-800/80" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-transparent px-2 text-xs text-zinc-500">o con tu email</span>
      </div>
    </div>
  )
}

export function AuthView() {
  const [tab, setTab] = useState<"login" | "register">("login")
  const [demoOpen, setDemoOpen] = useState(false)

  const { data: authStatus } = useQuery<AuthStatusResponse>({
    queryKey: ["auth-status"],
    queryFn: fetchAuthStatus,
  })

  // Login con email
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  // Registro con email
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regLoading, setRegLoading] = useState(false)

  function handleGoogle() {
    if (authStatus?.googleConfigured) {
      void signIn("google", { callbackUrl: "/" })
    } else {
      setDemoOpen(true)
    }
  }

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
    setRegLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: regPassword }),
      })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as ApiErrorShape | null
        toast.error(errorData?.error ?? "No se pudo crear tu cuenta")
        return
      }
      const result = await signIn("credentials", {
        email,
        password: regPassword,
        redirect: false,
      })
      if (result?.error) toast.error("Cuenta creada. Ingresa desde la pestaña Ingresar.")
    } catch {
      toast.error("No se pudo crear tu cuenta. Intenta de nuevo.")
    } finally {
      setRegLoading(false)
    }
  }

  function applyDemoAccount() {
    setLoginEmail(DEMO_EMAIL)
    setLoginPassword(DEMO_PASSWORD)
    setTab("login")
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#050505]">
      {/* Fondo vivo: auroras + polvo de oro + retícula */}
      <AlchemyBackground density={1.15} />

      {/* ============ ESCENA ============ */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-12 pt-10 sm:pt-14">
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-7 sm:gap-9">
          {/* El Portal Dorado con chips orbitando (desktop) */}
          <div className="relative">
            <GoldenPortal size={168} />
            {ORBIT_CHIPS.map((chip) => (
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
            <KineticWordmark className="text-2xl sm:text-3xl" />
            <p className="mt-3 max-w-xs text-balance text-sm leading-relaxed text-zinc-400 sm:max-w-none sm:text-base">
              Donde el marketing se{" "}
              <span className="gold-text font-semibold">transmuta</span> en ventas
            </p>
          </div>

          {/* ============ LA PUERTA ============ */}
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

              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 w-full gap-2 border-zinc-800 bg-zinc-950/60 transition-all hover:border-gold/40 hover:bg-zinc-900/80 hover:shadow-[0_0_24px_-8px_rgba(217,164,65,0.4)]"
                onClick={handleGoogle}
              >
                <GoogleLogo className="h-5 w-5" />
                Continuar con Google
              </Button>

              <EmailDivider />

              <TabsContent value="login" className="mt-0 data-[state=active]:animate-view">
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

                {/* Cuenta demo */}
                <div className="mt-4 rounded-xl border border-dashed border-gold/40 bg-gold/[0.07] p-3 text-xs text-zinc-400">
                  <p className="flex items-start gap-1.5">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                    <span className="min-w-0">
                      Miembro demo: <span className="font-medium text-zinc-200">{DEMO_EMAIL}</span> ·{" "}
                      <span className="font-medium text-zinc-200">{DEMO_PASSWORD}</span>
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={applyDemoAccount}
                    className="mt-2 w-full text-gold-bright hover:bg-gold/10 hover:text-gold-bright sm:ml-auto sm:mt-0 sm:w-auto"
                  >
                    Usar
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="register" className="mt-0 data-[state=active]:animate-view">
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
                  <Button type="submit" className="btn-gold h-11 w-full font-semibold" disabled={regLoading}>
                    {regLoading ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Forjar mi cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-500">
              Al entrar aceptas las reglas del gremio.
              <br />© ALQEMIA · Marketing & Ecommerce
            </p>
          </div>
        </div>
      </main>

      {/* ============ CINTA DE CÓDICE ============ */}
      <div className="relative z-10 -mx-2 -rotate-[1.1deg]">
        <Marquee items={MARQUEE_ITEMS} />
      </div>

      <GoogleDemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  )
}

"use client"

import { useState, type FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { GraduationCap, Loader2, Users, Wrench, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { GoogleDemoDialog } from "@/components/alqemira/google-demo-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const HERO_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: "Comunidad activa" },
  { icon: GraduationCap, label: "Programas grabados" },
  { icon: Wrench, label: "Herramientas de crecimiento" },
]

const DEMO_EMAIL = "valeria@alqemira.com"
const DEMO_PASSWORD = "alqemira123"

function EmailDivider() {
  return (
    <div className="relative py-3" aria-hidden="true">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-zinc-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-2 text-xs text-zinc-400">o con tu email</span>
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
    <div className="grid min-h-dvh bg-white lg:grid-cols-2">
      {/* Panel héroe (solo desktop) */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-end">
        { }
        <img
          src="/images/auth-hero.png"
          alt="Espacio de trabajo de la comunidad ALQEMIRA"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        <div className="relative z-10 p-10">
          <span className="gold-text font-display text-3xl tracking-tight">ALQEMIRA</span>
          <p className="mt-3 max-w-md text-zinc-300">
            La academia donde el marketing se transmuta en ventas.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {HERO_CHIPS.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm"
              >
                <chip.icon className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* Panel de acceso */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Marca */}
          <div className="flex items-center gap-3">
            { }
            <img
              src="/images/logo-mark.png"
              alt="Logotipo de ALQEMIRA"
              className="h-12 w-12 rounded-xl shadow"
            />
            <div>
              <span className="font-display text-xl tracking-tight text-zinc-900">ALQEMIRA</span>
              <p className="text-sm text-zinc-500">Ingresa al hub</p>
            </div>
          </div>

          {/* Strip héroe compacto (solo móvil) */}
          <div className="relative mt-6 h-28 overflow-hidden rounded-2xl bg-zinc-950 lg:hidden">
            { }
            <img
              src="/images/auth-hero.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 to-zinc-950/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="gold-text font-display text-2xl tracking-tight">ALQEMIRA</span>
            </div>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value === "register" ? "register" : "login")}
            className="mt-6 lg:mt-8"
          >
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="login">Ingresar</TabsTrigger>
              <TabsTrigger value="register">Crear cuenta</TabsTrigger>
            </TabsList>

            <Button
              type="button"
              variant="outline"
              className="mt-4 h-11 w-full gap-2"
              onClick={handleGoogle}
            >
              <GoogleLogo className="h-5 w-5" />
              Continuar con Google
            </Button>

            <EmailDivider />

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="tu@email.com"
                    className="mt-2 h-11"
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
                    className="mt-2 h-11"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loginLoading}>
                  {loginLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Ingresar
                </Button>
              </form>

              {/* Cuenta demo */}
              <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3 text-xs text-zinc-600">
                <div className="flex items-center justify-between gap-2">
                  <p>
                    Cuenta de miembro demo:{" "}
                    <span className="font-medium text-zinc-800">{DEMO_EMAIL}</span> ·{" "}
                    <span className="font-medium text-zinc-800">{DEMO_PASSWORD}</span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={applyDemoAccount}
                    className="shrink-0"
                  >
                    Usar
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="register" className="mt-0">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-name">Nombre completo</Label>
                  <Input
                    id="register-name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Tu nombre y apellido"
                    className="mt-2 h-11"
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
                    className="mt-2 h-11"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <span className="text-xs text-zinc-400">Mínimo 6 caracteres</span>
                  </div>
                  <Input
                    id="register-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Crea una contraseña"
                    className="mt-2 h-11"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={regLoading}>
                  {regLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Crear mi cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-400">
              Al crear tu cuenta aceptas las reglas de la comunidad.
            </p>
            <p className="mt-1 text-xs text-zinc-400">© ALQEMIRA · Marketing & Ecommerce</p>
          </div>

          <GoogleDemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
        </div>
      </main>
    </div>
  )
}

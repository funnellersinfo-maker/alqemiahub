"use client"

// ============================================================
// ALQEMIRA HUB — Página principal (única ruta visible)
// Splash → AuthView → OnboardingFlow → AppShell
// ============================================================

import { useSession, signOut } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { ShieldAlert, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMe } from "@/hooks/use-me"
import { AuthView } from "@/components/alqemira/auth-view"
import { OnboardingFlow } from "@/components/alqemira/onboarding-flow"
import { AppShell } from "@/components/alqemira/app-shell"
import { XpToaster } from "@/components/alqemira/xp-toaster"

function Splash() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950">
      { }
      <img
        src="/images/logo-mark.png"
        alt="ALQEMIRA"
        className="h-16 w-16 rounded-2xl animate-logo-glow object-cover"
      />
      <p className="font-display text-xs font-medium tracking-[0.35em] text-amber-300/80">ALQEMIRA</p>
      <Loader2 className="h-4 w-4 animate-spin text-zinc-600" aria-label="Cargando" />
    </main>
  )
}

function BlockedScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
        <ShieldAlert className="h-8 w-8 text-red-400" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-semibold text-white">Tu cuenta está suspendida</h1>
      <p className="max-w-sm text-sm text-zinc-400">
        El equipo de ALQEMIRA suspendió temporalmente tu acceso. Si crees que es un error, escríbele a
        soporte para revisarlo.
      </p>
      <Button
        variant="outline"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
      >
        Salir de la sesión
      </Button>
    </main>
  )
}

export default function Home() {
  const { status } = useSession()
  const { data, isLoading, isError } = useMe()
  const queryClient = useQueryClient()

  // 1) Sesión cargando
  if (status === "loading") return <Splash />

  // 2) Sin sesión → autenticación
  if (status === "unauthenticated") {
    return (
      <>
        <XpToaster />
        <AuthView />
      </>
    )
  }

  // 3) Con sesión: perfil fresco cargando
  if (isLoading || !data) return <Splash />

  // 3b) Error al cargar el perfil (p.ej. sesión inválida)
  if (isError) {
    return <BlockedScreen />
  }

  const user = data.user

  // 4) Cuenta bloqueada por el admin
  if (user.status === "BLOCKED") {
    return (
      <>
        <XpToaster />
        <BlockedScreen />
      </>
    )
  }

  // 5) Nuevo miembro → onboarding gamificado
  if (!user.profileCompleted) {
    return (
      <>
        <XpToaster />
        <OnboardingFlow onComplete={() => queryClient.invalidateQueries({ queryKey: ["me"] })} />
      </>
    )
  }

  // 6) Miembro activo → el Hub
  return (
    <>
      <XpToaster />
      <AppShell />
    </>
  )
}

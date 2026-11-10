"use client"

// ============================================================
// ALQEMIA HUB — Página principal (única ruta visible)
// Splash → AuthView → OnboardingFlow → AppShell
// ============================================================

import { useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { ShieldAlert, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMe } from "@/hooks/use-me"
import { AuthView } from "@/components/alqemia/auth-view"
import { OnboardingFlow } from "@/components/alqemia/onboarding-flow"
import { AppShell } from "@/components/alqemia/app-shell"
import { XpToaster } from "@/components/alqemia/xp-toaster"
import { AlchemyBackground } from "@/components/alqemia/fx/alchemy-background"
import { GoldenPortal } from "@/components/alqemia/fx/golden-portal"
import { KineticWordmark } from "@/components/alqemia/fx/kinetic-wordmark"

function Splash() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-[#050505]">
      <AlchemyBackground density={0.9} />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <GoldenPortal size={128} />
        <KineticWordmark className="text-lg" delay={0.4} />
        <Loader2
          className="h-4 w-4 animate-spin text-gold/70"
          aria-label="Cargando"
        />
      </div>
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
        El equipo de ALQEMIA suspendió temporalmente tu acceso. Si crees que es un error, escríbele a
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

  // Sesión huérfana: la cookie apunta a una cuenta que ya no existe en la BD
  // (p. ej. tras un reset del seed). Se cierra la sesión automáticamente y
  // el usuario vuelve a La Primera Puerta en lugar de quedarse en el splash.
  useEffect(() => {
    if (status === "authenticated" && isError) {
      void signOut({ callbackUrl: "/" })
    }
  }, [status, isError])

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

  // 3) Con sesión: perfil fresco cargando (incluye el cierre automático de
  // sesiones huérfanas mientras se completa el signOut)
  if (isLoading || isError || !data) return <Splash />

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

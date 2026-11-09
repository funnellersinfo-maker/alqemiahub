"use client"

// ============================================================
// ALQEMIA HUB — AppShell: navega entre Muro, Classroom,
// Herramientas, Perfil y Panel Admin (la tuerca).
// Sidebar en desktop · header + tab bar en móvil · menú sandwich.
// ============================================================

import { useState } from "react"
import { signOut } from "next-auth/react"
import {
  Home,
  GraduationCap,
  Wrench,
  User,
  Menu,
  LogOut,
  Settings,
  Lock,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore, type AppView } from "@/lib/store"
import { useMe } from "@/hooks/use-me"
import { UserAvatar } from "@/components/alqemia/avatar"
import { AlchemyBackground } from "@/components/alqemia/fx/alchemy-background"
import { FeedView } from "@/components/alqemia/feed/feed-view"
import { ClassroomView } from "@/components/alqemia/classroom/classroom-view"
import { ToolsView } from "@/components/alqemia/tools/tools-view"
import { ProfileView } from "@/components/alqemia/profile/profile-view"
import { AdminView } from "@/components/alqemia/admin/admin-view"
import { AdminGate } from "@/components/alqemia/admin/admin-gate"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

type NavKey = "feed" | "classroom" | "tools" | "profile"

const NAV: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: "feed", label: "Muro", icon: Home },
  { key: "classroom", label: "Classroom", icon: GraduationCap },
  { key: "tools", label: "Herramientas", icon: Wrench },
  { key: "profile", label: "Perfil", icon: User },
]

function Logo({ className }: { className?: string }) {
  return (
     
    <img
      src="/images/logo-mark.png"
      alt="ALQEMIA"
      className={cn("h-9 w-9 rounded-lg object-cover", className)}
      draggable={false}
    />
  )
}

function handleLogout() {
  useAppStore.getState().reset()
  signOut({ callbackUrl: "/" })
}

/** La TUERCA: acceso al Panel de Administración con clave */
function TuercaButton({
  unlocked,
  onClick,
  className,
}: {
  unlocked: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        className
      )}
      aria-label="Panel de Administración"
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <Settings className="h-5 w-5 transition-transform duration-500 group-hover:rotate-90" aria-hidden />
        {!unlocked && (
          <Lock className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-zinc-950 text-gold p-[1px]" aria-hidden />
        )}
      </span>
      <span className="flex-1 text-left font-medium">Panel de Administración</span>
      {unlocked && <ShieldCheck className="h-4 w-4 text-gold" aria-hidden />}
    </button>
  )
}

export function AppShell() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const adminUnlocked = useAppStore((s) => s.adminUnlocked)
  const setAdminGateOpen = useAppStore((s) => s.setAdminGateOpen)
  const [menuOpen, setMenuOpen] = useState(false)
  const { data } = useMe()
  const user = data?.user
  const level = user?.level

  const openTuerca = () => {
    if (adminUnlocked) setView("admin")
    else setAdminGateOpen(true)
  }

  const go = (key: AppView) => {
    setView(key)
    setMenuOpen(false)
  }

  return (
    <div className="relative min-h-dvh bg-background">
      {/* Fondo alquímico ambiente (detrás de todo el contenido) */}
      <AlchemyBackground density={0.4} className="fixed inset-0 z-0" />

      {/* ============ SIDEBAR DESKTOP ============ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-zinc-950 lg:flex">
        <div className="flex items-center gap-3 p-5">
          <Logo />
          <div className="min-w-0">
            <p className="brand-wordmark pl-[0.38em] text-[13px] leading-tight">ALQEMIA</p>
            <p className="mt-0.5 text-[9px] font-medium tracking-[0.22em] text-gold/70">MARKETING · ECOMMERCE</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Principal">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = view === key
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-800/80 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold" aria-hidden />
                )}
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Progreso del usuario */}
        {level && (
          <div className="mx-4 mb-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-300">
                Nv {level.level} · {level.name}
              </p>
              <span className="flex items-center gap-1 text-xs font-semibold text-gold">
                <Zap className="h-3 w-3 fill-gold" aria-hidden />
                {level.currentXp}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-gold-deep transition-all duration-500"
                style={{ width: `${level.progressPct}%` }}
              />
            </div>
            {level.xpToNext !== null && (
              <p className="mt-1.5 text-[10px] text-zinc-400">{level.xpToNext} XP para el siguiente nivel</p>
            )}
          </div>
        )}

        {/* La tuerca — siempre visible */}
        <div className="px-3">
          <TuercaButton
            unlocked={adminUnlocked}
            onClick={openTuerca}
            className="text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
          />
        </div>

        {/* Usuario */}
        <div className="border-t border-zinc-800 p-3">
          {user && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("profile")}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-900"
              >
                <UserAvatar user={user} size="sm" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-zinc-200">{user.name}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    Nv {level?.level} · {level?.name}
                  </span>
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                className="h-9 w-9 shrink-0 text-zinc-500 hover:text-red-400 hover:bg-zinc-900"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ============ HEADER MÓVIL ============ */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/85 px-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <p className="brand-wordmark pl-[0.38em] text-[11px]">ALQEMIA</p>
        </div>
        <div className="flex items-center gap-3">
          {user && level && (
            <button
              onClick={() => setView("profile")}
              className="flex items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-gold-bright transition-transform active:scale-95"
              aria-label={`${level.currentXp} XP · Nivel ${level.level}`}
            >
              <Zap className="h-3 w-3 fill-gold text-gold" aria-hidden />
              {level.currentXp}
              <span className="text-zinc-500">·</span>
              <span className="font-medium text-zinc-300">Nv {level.level}</span>
            </button>
          )}
          {user && (
            <button onClick={() => setView("profile")} aria-label="Ir a mi perfil">
              <UserAvatar user={user} size="sm" />
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            className="h-9 w-9 rounded-lg hover:bg-zinc-800/60"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* ============ CONTENIDO ============ */}
      <div className="relative z-10 lg:pl-64">
        <main className="px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">
          <div key={view} className="animate-view">
            {view === "feed" && <FeedView />}
            {view === "classroom" && <ClassroomView />}
            {view === "tools" && <ToolsView />}
            {view === "profile" && <ProfileView />}
            {view === "admin" && <AdminView />}
          </div>
        </main>
      </div>

      {/* ============ TAB BAR MÓVIL ============ */}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md lg:hidden"
        aria-label="Navegación"
      >
        {NAV.map(({ key, label, icon: Icon }) => {
          const active = view === key
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                active ? "text-gold" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="relative">
                <span
                  key={`${key}-${String(active)}`}
                  className={cn("flex", active && "animate-chip-pop")}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {active && (
                  <span
                    className="animate-chip-pop absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold-deep"
                    aria-hidden
                  />
                )}
              </span>
              {label}
            </button>
          )
        })}
      </nav>

      {/* ============ MENÚ SANDWICH (móvil) ============ */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="w-[290px] border-l border-zinc-800 bg-zinc-950 p-0 text-zinc-300 sm:max-w-none [&>button]:text-zinc-400 [&>button:hover]:text-white"
        >
          <SheetHeader className="border-b border-zinc-800 p-5">
            <div className="flex items-center gap-3">
              <Logo />
              <div className="min-w-0">
                <SheetTitle className="brand-wordmark pl-[0.38em] text-[13px] leading-tight">ALQEMIA</SheetTitle>
                <SheetDescription className="sr-only">
                  Menú de navegación del Hub: Muro, Classroom, Herramientas, Perfil y Panel de Administración.
                </SheetDescription>
                <p className="text-[9px] font-medium tracking-[0.22em] text-gold/70">MARKETING · ECOMMERCE</p>
              </div>
            </div>
          </SheetHeader>

          <nav className="space-y-1 p-3" aria-label="Menú">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = view === key
              return (
                <button
                  key={key}
                  onClick={() => go(key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-zinc-800/80 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {label}
                </button>
              )
            })}

            <div className="my-2 border-t border-zinc-800" />

            {/* La tuerca — siempre en el menú sandwich */}
            <TuercaButton
              unlocked={adminUnlocked}
              onClick={() => {
                setMenuOpen(false)
                openTuerca()
              }}
              className="text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
            />
          </nav>

          <div className="absolute inset-x-0 bottom-0 border-t border-zinc-800 p-3">
            {user && (
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => go("profile")}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-900"
                >
                  <UserAvatar user={user} size="sm" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-zinc-200">{user.name}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{user.email}</span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  aria-label="Cerrar sesión"
                  className="h-9 w-9 shrink-0 text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="px-2 text-center text-[10px] text-zinc-400">© ALQEMIA · Hub de la comunidad</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de la clave del admin */}
      <AdminGate />
    </div>
  )
}

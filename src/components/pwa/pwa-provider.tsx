"use client"

// ============================================================
// PWA — Registro del Service Worker + invitación a instalar
// · PC/Android (Chrome/Edge): banner nativo "Instalar app" →
//   queda anclada al escritorio / barra de tareas / launcher
// · iPhone (Safari no soporta el prompt nativo): tarjeta con
//   los pasos "Compartir → Añadir a pantalla de inicio"
// ============================================================

import { useEffect, useState } from "react"
import { Download, Share, Smartphone, X } from "lucide-react"

import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "alqemia-install-dismissed"

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosCard, setShowIosCard] = useState(false)
  const [visible, setVisible] = useState(false)

  // 1) Registrar el Service Worker (solo producción: en dev evita caché vieja)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  // 2) Detectar capacidad de instalación
  useEffect(() => {
    if (isStandalone()) return
    const dismissed = localStorage.getItem(DISMISS_KEY)

    if (isIOS()) {
      if (!dismissed) {
        const t = setTimeout(() => setShowIosCard(true), 4000)
        return () => clearTimeout(t)
      }
      return
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      if (!dismissed) setVisible(true)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === "accepted") {
      setVisible(false)
    }
    setInstallEvent(null)
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1")
    setVisible(false)
    setShowIosCard(false)
  }

  if (isStandalone()) return null

  // ----- iPhone: instrucciones manuales -----
  if (showIosCard) {
    return (
      <div
        role="dialog"
        aria-label="Instalar la app en iPhone"
        className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-gold/30 bg-zinc-950/95 p-4 shadow-[0_0_40px_-10px_rgba(212,175,55,0.45)] backdrop-blur-md animate-fade-up pb-safe"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
            <Smartphone className="h-5 w-5 text-gold-bright" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-100">Instala ALQEMIA en tu iPhone</p>
            <ol className="mt-1.5 space-y-1 text-xs leading-relaxed text-zinc-400">
              <li>
                1. Toca el ícono <strong className="text-zinc-200">Compartir</strong>{" "}
                <Share className="inline h-3 w-3" aria-hidden /> en la barra de Safari
              </li>
              <li>
                2. Elige <strong className="text-zinc-200">"Añadir a pantalla de inicio"</strong>
              </li>
              <li>
                3. Confirma y ALQEMIA quedará como app con su ícono dorado
              </li>
            </ol>
          </div>
          <button
            onClick={dismiss}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  // ----- PC / Android: prompt nativo -----
  if (!visible || !installEvent) return null

  return (
    <div
      role="dialog"
      aria-label="Instalar la aplicación"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gold/30 bg-zinc-950/95 p-4 shadow-[0_0_40px_-10px_rgba(212,175,55,0.45)] backdrop-blur-md animate-fade-up pb-safe"
    >
      <img
        src="/icon-192.png"
        alt=""
        className="h-10 w-10 shrink-0 rounded-xl"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100">Instala la app de ALQEMIA</p>
        <p className="text-xs text-zinc-400">Queda anclada a tu escritorio o barra de tareas, como una app real.</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="text-zinc-500 hover:text-zinc-300"
          onClick={dismiss}
        >
          Ahora no
        </Button>
        <Button size="sm" className="btn-gold font-semibold" onClick={() => void install()}>
          <Download aria-hidden />
          Instalar
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// ALQEMIRA HUB — Estado global del cliente (Zustand)
// Navegación de vistas, acceso admin y toasts de gamificación
// ============================================================

import { create } from "zustand"
import type { XpEvent } from "@/lib/types"

export type AppView = "feed" | "classroom" | "tools" | "profile" | "admin"

export type XpToastItem = {
  id: number
  kind: "xp" | "levelup" | "achievement"
  title: string
  subtitle?: string
}

let toastCounter = 0

interface AppState {
  view: AppView
  setView: (view: AppView) => void
  adminUnlocked: boolean
  setAdminUnlocked: (unlocked: boolean) => void
  adminGateOpen: boolean
  setAdminGateOpen: (open: boolean) => void
  xpToasts: XpToastItem[]
  pushXpToast: (item: Omit<XpToastItem, "id">) => void
  dismissXpToast: (id: number) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  view: "feed",
  setView: (view) => set({ view }),
  adminUnlocked: false,
  setAdminUnlocked: (adminUnlocked) => set({ adminUnlocked }),
  adminGateOpen: false,
  setAdminGateOpen: (adminGateOpen) => set({ adminGateOpen }),
  xpToasts: [],
  pushXpToast: (item) => {
    const id = ++toastCounter
    set({ xpToasts: [...get().xpToasts, { ...item, id }] })
  },
  dismissXpToast: (id) => set({ xpToasts: get().xpToasts.filter((t) => t.id !== id) }),
  reset: () => set({ view: "feed", adminUnlocked: false, adminGateOpen: false, xpToasts: [] }),
}))

/**
 * Celebra un evento de XP: muestra toasts de +XP, subida de nivel
 * y logros nuevos. Llamar tras cada mutación que devuelva `xp`.
 */
export function celebrateXp(ev: XpEvent | null | undefined) {
  if (!ev) return
  const store = useAppStore.getState()
  if (ev.awarded > 0) {
    store.pushXpToast({
      kind: "xp",
      title: `+${ev.awarded} XP`,
      subtitle: "Sigue transmutando tu camino",
    })
  }
  if (ev.leveledUp) {
    store.pushXpToast({
      kind: "levelup",
      title: `Nivel ${ev.level.level} · ${ev.level.name}`,
      subtitle: "Has subido de nivel",
    })
  }
  if (ev.achievement) {
    store.pushXpToast({
      kind: "achievement",
      title: `Nuevo logro: ${ev.achievement.label}`,
      subtitle: "Visible en tu perfil",
    })
  }
}

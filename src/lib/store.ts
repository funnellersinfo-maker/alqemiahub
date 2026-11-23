// ============================================================
// ALQEMIA HUB — Estado global del cliente (Zustand)
// Navegación de vistas, acceso admin y toasts de gamificación
// ============================================================

import { create } from "zustand"
import type { XpEvent } from "@/lib/types"

export type AppView =
  | "feed"
  | "live"
  | "classroom"
  | "codes"
  | "market"
  | "tools"
  | "ai"
  | "profile"
  | "admin"

export type XpToastItem = {
  id: number
  kind: "xp" | "levelup" | "achievement" | "evaluador"
  title: string
  subtitle?: string
  lines?: string[]
}

let toastCounter = 0

interface AppState {
  view: AppView
  setView: (view: AppView) => void
  adminUnlocked: boolean
  setAdminUnlocked: (unlocked: boolean) => void
  adminGateOpen: boolean
  setAdminGateOpen: (open: boolean) => void
  /** Conversación activa de El Oráculo (null → hilo nuevo). Se persiste aparte en localStorage por usuario. */
  oracleConversationId: string | null
  setOracleConversationId: (id: string | null) => void
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
  oracleConversationId: null,
  setOracleConversationId: (oracleConversationId) => set({ oracleConversationId }),
  xpToasts: [],
  pushXpToast: (item) => {
    const id = ++toastCounter
    set({ xpToasts: [...get().xpToasts, { ...item, id }] })
  },
  dismissXpToast: (id) => set({ xpToasts: get().xpToasts.filter((t) => t.id !== id) }),
  reset: () =>
    set({ view: "feed", adminUnlocked: false, adminGateOpen: false, oracleConversationId: null, xpToasts: [] }),
}))

/**
 * Celebra un evento de XP: muestra toasts de +XP, subida de nivel
 * y logros nuevos. Llamar tras cada mutación que devuelva `xp`.
 */
export function celebrateXp(ev: XpEvent | null | undefined) {
  if (!ev) return
  const store = useAppStore.getState()
  // El Evaluador: desglose de la evidencia valorada (si viene)
  if (ev.evidence && ev.evidence.lines.length > 0) {
    store.pushXpToast({
      kind: "evaluador",
      title: "El Evaluador ha hablado",
      subtitle: `Evidencia valorada: +${ev.evidence.total} XP${ev.evidence.capped ? " (tope alcanzado)" : ""}`,
      lines: ev.evidence.lines
        .filter((l) => l.xp !== 0)
        .map((l) => `${l.xp > 0 ? "+" : ""}${l.xp} · ${l.label} — ${l.detail}`),
    })
  }
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

// ============================================================
// ALQEMIA HUB — Perfil y completitud
// Niveles del quiz de onboarding y cálculo del % de perfil
// ============================================================

import type { MeUser } from "@/lib/types"

/** Opciones del quiz "¿En qué punto estás?" (onboarding + edición). */
export const EXPERIENCE_OPTIONS = [
  {
    value: "starter",
    label: "Estoy empezando",
    hint: "Aún no vendo o estoy armando mi primera oferta",
  },
  {
    value: "growing",
    label: "Ya vendo, quiero crecer",
    hint: "Tengo ventas y quiero escalar mis resultados",
  },
  {
    value: "scaling",
    label: "Escalo equipos y sistemas",
    hint: "Gestiono marcas, agencia o múltiples proyectos",
  },
] as const

export type ExperienceValue = (typeof EXPERIENCE_OPTIONS)[number]["value"]

export function experienceLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return EXPERIENCE_OPTIONS.find((o) => o.value === value)?.label ?? null
}

export function isExperienceValue(v: unknown): v is ExperienceValue {
  return typeof v === "string" && EXPERIENCE_OPTIONS.some((o) => o.value === v)
}

/**
 * Completitud del perfil (0–100). Cada pieza del ritual vale 20%:
 * avatar (color o foto), especialidades (headline), objetivos (goal),
 * nivel del quiz (experience) y bio.
 */
export function profileCompletion(user: {
  image?: string | null
  avatarColor?: string | null
  headline?: string | null
  goal?: string | null
  experience?: string | null
  bio?: string | null
}): number {
  const parts = [
    Boolean(user.image || user.avatarColor),
    Boolean(user.headline?.trim()),
    Boolean(user.goal?.trim()),
    Boolean(user.experience),
    Boolean(user.bio?.trim()),
  ]
  const filled = parts.filter(Boolean).length
  return Math.round((filled / parts.length) * 100)
}

/** Checklist amigable para UI (qué falta para llegar al 100%). */
export function completionChecklist(user: MeUser): { label: string; done: boolean }[] {
  return [
    { label: "Avatar (color o foto)", done: Boolean(user.image || user.avatarColor) },
    { label: "Especialidades", done: Boolean(user.headline?.trim()) },
    { label: "Objetivos", done: Boolean(user.goal?.trim()) },
    { label: "Nivel de experiencia", done: Boolean(user.experience) },
    { label: "Tu bio", done: Boolean(user.bio?.trim()) },
  ]
}

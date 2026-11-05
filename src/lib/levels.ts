// ============================================================
// ALQEMIRA HUB — Niveles y logros (módulo PURO, sin BD)
// Importable desde componentes cliente.
// ============================================================

import type { LevelInfo } from "@/lib/types"

export const LEVELS: { level: number; name: string; min: number }[] = [
  { level: 1, name: "Aprendiz", min: 0 },
  { level: 2, name: "Iniciado", min: 100 },
  { level: 3, name: "Practicante", min: 250 },
  { level: 4, name: "Artesano", min: 500 },
  { level: 5, name: "Alquimista", min: 900 },
  { level: 6, name: "Maestre", min: 1500 },
  { level: 7, name: "Gran Maestre", min: 2400 },
  { level: 8, name: "Leyenda", min: 3600 },
]

export function getLevelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp || 0))
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (safeXp >= l.min) current = l
  }
  const next = LEVELS[current.level] ?? null // LEVELS es 0-indexed
  const xpIntoLevel = safeXp - current.min
  if (!next) {
    return {
      level: current.level,
      name: current.name,
      currentXp: safeXp,
      xpIntoLevel,
      xpForLevel: Math.max(1, xpIntoLevel),
      nextLevelXp: null,
      xpToNext: null,
      progressPct: 100,
    }
  }
  const range = next.min - current.min
  const xpToNext = Math.max(0, next.min - safeXp)
  return {
    level: current.level,
    name: current.name,
    currentXp: safeXp,
    xpIntoLevel,
    xpForLevel: range,
    nextLevelXp: next.min,
    xpToNext,
    progressPct: Math.min(100, Math.floor((xpIntoLevel / range) * 100)),
  }
}

// Logros disponibles — icono = nombre de icono de lucide-react
export const ACHIEVEMENTS: Record<string, { label: string; icon: string }> = {
  perfil_completo: { label: "Perfil Transmutado", icon: "Sparkles" },
  primer_post: { label: "Primera Transmutación", icon: "FlaskConical" },
  tres_posts: { label: "Voz de la Comunidad", icon: "Megaphone" },
  primer_comentario: { label: "Conversador Nato", icon: "MessageCircle" },
  primera_leccion: { label: "Primer Paso", icon: "Footprints" },
  cinco_lecciones: { label: "Estudiante Dedicado", icon: "BookOpen" },
  curso_completo: { label: "Programa Dominado", icon: "Trophy" },
}

/** Mapa code -> icono de lucide para renderizar logros */
export const ACHIEVEMENT_ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(ACHIEVEMENTS).map(([code, a]) => [code, a.icon])
)

// ============================================================
// ALQEMIRA HUB — Motor de gamificación
// XP, niveles temáticos de alquimia, logros y recompensas
// ============================================================

import { db } from "@/lib/db"
import type { LevelInfo, XpAchievement, XpEvent } from "@/lib/types"

export const XP_REWARDS = {
  post: 15,
  comment: 5,
  lesson: 25,
  profile: 100,
  courseBonus: 50,
} as const

export type XpAction = "post" | "comment" | "lesson" | "profile" | "courseBonus"

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

export async function grantAchievement(userId: string, code: string): Promise<XpAchievement | null> {
  if (!ACHIEVEMENTS[code]) return null
  try {
    await db.achievement.create({ data: { userId, code } })
    const a = ACHIEVEMENTS[code]
    return { code, label: a.label, icon: a.icon }
  } catch {
    // Violación de unicidad → ya fue otorgado
    return null
  }
}

/**
 * Otorga XP por una acción del usuario y calcula logros asociados.
 * Debe llamarse DESPUÉS de registrar la acción (post, comentario, progreso).
 */
export async function awardXpFor(
  userId: string,
  action: XpAction,
  ctx?: { lessonId?: string }
): Promise<XpEvent | null> {
  const baseAmount = XP_REWARDS[action as keyof typeof XP_REWARDS] ?? 0
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || baseAmount <= 0) return null

  const before = getLevelInfo(user.xp)
  let amount = baseAmount
  let achievement: XpAchievement | null = null

  if (action === "post") {
    const count = await db.post.count({ where: { userId } })
    if (count >= 3) achievement = await grantAchievement(userId, "tres_posts")
    else if (count >= 1) achievement = await grantAchievement(userId, "primer_post")
  } else if (action === "comment") {
    const count = await db.comment.count({ where: { userId } })
    if (count >= 1) achievement = await grantAchievement(userId, "primer_comentario")
  } else if (action === "lesson") {
    const count = await db.lessonProgress.count({ where: { userId } })
    if (count >= 5) achievement = await grantAchievement(userId, "cinco_lecciones")
    else if (count >= 1) achievement = await grantAchievement(userId, "primera_leccion")
    if (ctx?.lessonId) {
      const lesson = await db.lesson.findUnique({
        where: { id: ctx.lessonId },
        include: { course: { include: { lessons: true } } },
      })
      if (lesson) {
        const lessonIds = lesson.course.lessons.map((l) => l.id)
        const done = await db.lessonProgress.count({
          where: { userId, lessonId: { in: lessonIds } },
        })
        if (done >= lessonIds.length && lessonIds.length > 0) {
          amount += XP_REWARDS.courseBonus
          achievement = (await grantAchievement(userId, "curso_completo")) ?? achievement
        }
      }
    }
  } else if (action === "profile") {
    achievement = await grantAchievement(userId, "perfil_completo")
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
  })
  const level = getLevelInfo(updated.xp)
  return {
    awarded: amount,
    totalXp: updated.xp,
    level,
    leveledUp: level.level > before.level,
    achievement: achievement ?? undefined,
  }
}

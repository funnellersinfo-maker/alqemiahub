// ============================================================
// ALQEMIA HUB — Motor de gamificación (lado servidor)
// XP, niveles, logros y recompensas. Los cálculos puros viven
// en @/lib/levels (importable en cliente); aquí se persisten.
// ============================================================

import { db } from "@/lib/db"
import type { XpAchievement, XpEvent } from "@/lib/types"
import { ACHIEVEMENTS, getLevelInfo } from "@/lib/levels"

export { LEVELS, getLevelInfo, ACHIEVEMENTS } from "@/lib/levels"

export const XP_REWARDS = {
  post: 15,
  comment: 5,
  lesson: 25,
  profile: 100,
  courseBonus: 50,
} as const

export type XpAction = "post" | "comment" | "lesson" | "profile" | "courseBonus"

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

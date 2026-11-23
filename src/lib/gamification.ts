// ============================================================
// ALQEMIA HUB — Motor de gamificación (lado servidor)
// XP, niveles, logros y recompensas. Los cálculos puros viven
// en @/lib/levels (importable en cliente); aquí se persisten.
//
// FILOSOFÍA (estilo Skool, versión ALQEMIA): el XP lo mueven
// los RESULTADOS, no las interacciones. Publicar y comentar
// dan poco; lo que de verdad hace avanzar de rango es reportar
// evidencia real (facturación, pedidos, ROAS) y que EL EVALUADOR
// —el algoritmo interno del gremio— la valore con rendimientos
// decrecientes, bonos de constancia y topes anti-abuso.
// ============================================================

import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import type { EvidenceLine, EvidenceVerdict, XpAchievement, XpEvent } from "@/lib/types"
import { ACHIEVEMENTS, getLevelInfo } from "@/lib/levels"

export {
  LEVELS,
  getLevelInfo,
  ACHIEVEMENTS,
  TITULAR_LEVEL,
  isTitular,
  getDisplayLevel,
  getDisplayXp,
} from "@/lib/levels"

// Las interacciones pesan poco: el que solo comenta no sube de
// rango. Los reportes de resultados (El Evaluador) son el motor.
export const XP_REWARDS = {
  post: 5,
  comment: 2,
  lesson: 25,
  profile: 100,
  courseBonus: 50,
  tour: 25,
} as const

export type XpAction =
  | "post"
  | "comment"
  | "lesson"
  | "profile"
  | "courseBonus"
  | "tour"
  | "report"

// ============================================================
// EL EVALUADOR — algoritmo de valoración de evidencia
// ============================================================
// Reglas de oro (justas y realistas):
//   1. Rendimientos decrecientes: crecer de $100 a $1.000 pesa
//      mucho; de $100.000 a $101.000, casi nada (escala log).
//   2. La constancia se premia: reportar seguido (2-8 reportes
//      en 30 días) suma un bono de hasta +15 XP.
//   3. El abuso se castiga: reportar varias veces el MISMO día
//      reduce el premio al 25% (la evidencia se reporta una vez
//      por jornada, cuando hay resultados nuevos).
//   4. Tope por reporte: 120 XP. Nadie sube de nivel de golpe.
//   5. La captura (imagen) respalda la evidencia: +8 XP.
// ============================================================

const EVIDENCE_BASE = 10 // registrar evidencia verificable
const EVIDENCE_CAP = 120 // tope absoluto por reporte
const REPEAT_DAY_FACTOR = 0.25 // 2º+ reporte del mismo día
const STREAK_CAP = 15 // bono máximo de constancia

export type EvidenceInput = {
  revenue: number | null
  orders: number | null
  roas: number | null
  hasImage: boolean
  /** reportes previos del usuario en los últimos 30 días (sin contar este) */
  reportsLast30d: number
  /** reportes ya hechos HOY por el usuario (sin contar este) */
  reportsToday: number
}

/** Núcleo PURO de El Evaluador: produce el veredicto y su desglose. */
export function evaluateEvidence(input: EvidenceInput): EvidenceVerdict {
  const lines: EvidenceLine[] = []
  const { revenue, orders, roas, hasImage, reportsLast30d, reportsToday } = input

  // 1) Base: evidencia registrada
  lines.push({
    label: "Evidencia registrada",
    detail: "Reporte de resultados publicado en el muro",
    xp: EVIDENCE_BASE,
  })

  // 2) Facturación — escala logarítmica: ln(1 + ingresos/100)
  //    $100 → +9 · $1.000 → +32 · $10.000 → +54 · $100.000+ → tope 60
  if (revenue !== null && revenue > 0) {
    const xp = Math.min(60, Math.round(14 * Math.log(1 + revenue / 100)))
    lines.push({
      label: "Facturación reportada",
      detail: `+$${new Intl.NumberFormat("es", { maximumFractionDigits: 0 }).format(revenue)} en ventas`,
      xp,
    })
  }

  // 3) Pedidos — volumen de operación: ln(1 + pedidos/5)
  //    10 pedidos → +8 · 50 → +18 · 200+ → tope 25
  if (orders !== null && orders > 0) {
    const xp = Math.min(25, Math.round(6 * Math.log(1 + orders / 5)))
    lines.push({
      label: "Pedidos procesados",
      detail: `${new Intl.NumberFormat("es").format(orders)} pedidos`,
      xp,
    })
  }

  // 4) ROAS — rentabilidad publicitaria (solo desde 1.5x)
  //    ROAS 2 → +10 · ROAS 3 → +20 · ROAS 3.5+ → tope 25
  if (roas !== null && roas >= 1.5) {
    const xp = Math.min(25, Math.round((roas - 1) * 10))
    lines.push({
      label: "ROAS reportado",
      detail: `x${roas.toFixed(1)} de retorno sobre inversión`,
      xp,
    })
  }

  // 5) Captura de respaldo — la imagen que acredita el número
  if (hasImage) {
    lines.push({
      label: "Evidencia visual",
      detail: "Publicación con captura de respaldo",
      xp: 8,
    })
  }

  // 6) Constancia — reportar con regularidad (2 a 8 reportes / 30 días)
  if (reportsLast30d >= 1) {
    const xp = Math.min(STREAK_CAP, reportsLast30d * 3)
    lines.push({
      label: "Constancia del alquimista",
      detail: `${reportsLast30d + 1} reportes en los últimos 30 días`,
      xp,
    })
  }

  let raw = lines.reduce((acc, l) => acc + l.xp, 0)
  let capped = false

  // 7) Anti-abuso: repetir reportes el mismo día desinfla el premio
  if (reportsToday >= 1 && raw > 0) {
    const reduced = Math.max(2, Math.round(raw * REPEAT_DAY_FACTOR))
    lines.push({
      label: "Ajuste anti-abuso",
      detail: "Ya reportaste hoy: solo cuentan resultados nuevos",
      xp: -(raw - reduced),
    })
    raw = reduced
  }

  // 8) Tope absoluto por reporte
  if (raw > EVIDENCE_CAP) {
    raw = EVIDENCE_CAP
    capped = true
  }

  return { total: Math.max(0, raw), lines, capped }
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
  ctx?: {
    lessonId?: string
    /** Evidencia del post (para "report": la valora El Evaluador) */
    evidence?: {
      revenue: number | null
      orders: number | null
      roas: number | null
      hasImage: boolean
    }
  }
): Promise<XpEvent | null> {
  const baseAmount = XP_REWARDS[action as keyof typeof XP_REWARDS] ?? 0
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const before = getLevelInfo(user.xp)
  let amount: number = baseAmount
  let achievement: XpAchievement | null = null
  let evidence: EvidenceVerdict | undefined

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
  } else if (action === "tour") {
    achievement = await grantAchievement(userId, "mapa_descifrado")
  } else if (action === "report") {
    // ---- EL EVALUADOR: la evidencia manda ----
    const ev = ctx?.evidence ?? { revenue: null, orders: null, roas: null, hasImage: false }
    const now = new Date()
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const evidenceWhere: Prisma.PostWhereInput = {
      userId,
      OR: [
        { metricRevenue: { not: null } },
        { metricOrders: { not: null } },
        { metricRoas: { not: null } },
      ],
    }
    const [reportsLast30d, reportsToday] = await Promise.all([
      db.post.count({ where: { ...evidenceWhere, createdAt: { gte: since30 } } }),
      db.post.count({ where: { ...evidenceWhere, createdAt: { gte: startOfDay } } }),
    ])
    const verdict = evaluateEvidence({
      revenue: ev.revenue,
      orders: ev.orders,
      roas: ev.roas,
      hasImage: ev.hasImage,
      reportsLast30d,
      reportsToday,
    })
    amount = verdict.total
    evidence = verdict
    // Logros de evidencia
    const reports = await db.post.count({ where: evidenceWhere })
    if (reports >= 5) achievement = await grantAchievement(userId, "maestro_evidencia")
    else if (reports >= 1) achievement = await grantAchievement(userId, "primer_reporte")
  }

  if (amount <= 0) return null

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
    ...(evidence ? { evidence } : {}),
  }
}

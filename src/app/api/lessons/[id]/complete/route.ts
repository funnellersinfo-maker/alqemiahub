// POST /api/lessons/[id]/complete — Marcar lección completada (+ XP una sola vez)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { awardXpFor } from "@/lib/gamification"
import type { XpEvent } from "@/lib/types"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireActiveUser()

    const lesson = await db.lesson.findUnique({ where: { id } })
    if (!lesson) return errorResponse(404, "Lección no encontrada")

    const existing = await db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    })
    if (existing) return Response.json({ ok: true, xp: null })

    await db.lessonProgress.create({
      data: { userId: user.id, lessonId: lesson.id },
    })

    // XP tras registrar la acción (incluye bonus al completar el programa)
    const xp: XpEvent | null = await awardXpFor(user.id, "lesson", { lessonId: lesson.id })
    return Response.json({ ok: true, xp })
  } catch (e) {
    return handleApiError(e)
  }
}

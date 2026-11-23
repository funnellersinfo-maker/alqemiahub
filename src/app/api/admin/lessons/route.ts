// ============================================================
// /api/admin/lessons — crear lección dentro de un programa
// PATCH/DELETE → /api/admin/lessons/[id]
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    const courseId = typeof body.courseId === "string" ? body.courseId : ""
    if (!courseId) return errorResponse(400, "Falta el programa")
    const course = await db.course.findUnique({ where: { id: courseId } })
    if (!course) return errorResponse(404, "Programa no encontrado")

    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (title.length < 3 || title.length > 120) {
      return errorResponse(400, "El título debe tener entre 3 y 120 caracteres")
    }
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : ""
    const videoUrl = typeof body.videoUrl === "string" && body.videoUrl.trim() ? body.videoUrl.trim() : null
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
      return errorResponse(400, "La URL del vídeo debe empezar por http:// o https://")
    }
    if (videoUrl && videoUrl.length > 1000) return errorResponse(400, "URL demasiado larga")
    const durationMin =
      typeof body.durationMin === "number" && Number.isFinite(body.durationMin)
        ? Math.max(1, Math.min(600, Math.round(body.durationMin)))
        : 10

    // Orden: al final del programa por defecto
    let order: number
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      order = Math.max(0, Math.floor(body.order))
    } else {
      const last = await db.lesson.findFirst({
        where: { courseId },
        orderBy: { order: "desc" },
        select: { order: true },
      })
      order = (last?.order ?? 0) + 1
    }

    const created = await db.lesson.create({
      data: { courseId, title, description, videoUrl, durationMin, order },
    })
    return Response.json({ lesson: { id: created.id } }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

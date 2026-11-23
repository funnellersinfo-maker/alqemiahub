// ============================================================
// /api/admin/courses/[id] — editar / eliminar programa (Estudio)
// PATCH  → título, descripción, nivel, portada, orden
// DELETE → eliminar programa con sus lecciones (cascade)
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import { MEDIA_KEY_RE, deleteMedia } from "@/lib/media-store"

type Ctx = { params: Promise<{ id: string }> }

const LEVELS = new Set(["Principiante", "Intermedio", "Avanzado"])

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")
    const { id } = await ctx.params
    const course = await db.course.findUnique({ where: { id } })
    if (!course) return errorResponse(404, "Programa no encontrado")

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const data: Record<string, string | number> = {}

    if (typeof body.title === "string") {
      const title = body.title.trim()
      if (title.length < 3 || title.length > 120) {
        return errorResponse(400, "El título debe tener entre 3 y 120 caracteres")
      }
      data.title = title
    }
    if (typeof body.description === "string") {
      data.description = body.description.trim().slice(0, 1000)
    }
    if (typeof body.level === "string" && LEVELS.has(body.level)) {
      data.level = body.level
    }
    if (typeof body.cover === "string" && body.cover.length > 0) {
      if (!body.cover.startsWith("/") && !body.cover.startsWith("data:image/")) {
        return errorResponse(400, "Portada inválida (ruta interna o imagen)")
      }
      if (body.cover.length > 500_000) return errorResponse(400, "La portada es demasiado grande")
      data.cover = body.cover
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      data.order = Math.max(0, Math.floor(body.order))
    }

    if (Object.keys(data).length === 0) return errorResponse(400, "Nada que actualizar")

    await db.course.update({ where: { id }, data })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")
    const { id } = await ctx.params
    const course = await db.course.findUnique({ where: { id } })
    if (!course) return errorResponse(404, "Programa no encontrado")

    // cascade borra lecciones y progreso de los miembros
    // (antes recogemos los vídeos subidos para limpiar el almacén)
    const lessons = await db.lesson.findMany({
      where: { courseId: id },
      select: { videoUrl: true },
    })
    await db.course.delete({ where: { id } })
    for (const l of lessons) {
      if (l.videoUrl?.startsWith("/api/media/")) {
        const key = l.videoUrl.slice("/api/media/".length)
        if (MEDIA_KEY_RE.test(key)) await deleteMedia(key).catch(() => {})
      }
    }
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

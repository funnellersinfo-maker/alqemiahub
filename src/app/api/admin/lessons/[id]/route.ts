// ============================================================
// /api/admin/lessons/[id] — editar / eliminar / reordenar lección
// PATCH  → título, descripción, vídeo, duración, orden
// DELETE → eliminar lección (y el progreso asociado)
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")
    const { id } = await ctx.params
    const lesson = await db.lesson.findUnique({ where: { id } })
    if (!lesson) return errorResponse(404, "Lección no encontrada")

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const data: Record<string, string | number | null> = {}

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
    if (body.videoUrl === null || typeof body.videoUrl === "string") {
      const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : ""
      if (videoUrl === "") {
        data.videoUrl = null
      } else {
        if (!/^https?:\/\//i.test(videoUrl)) {
          return errorResponse(400, "La URL del vídeo debe empezar por http:// o https://")
        }
        if (videoUrl.length > 1000) return errorResponse(400, "URL demasiado larga")
        data.videoUrl = videoUrl
      }
    }
    if (typeof body.durationMin === "number" && Number.isFinite(body.durationMin)) {
      data.durationMin = Math.max(1, Math.min(600, Math.round(body.durationMin)))
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      data.order = Math.max(0, Math.floor(body.order))
    }

    if (Object.keys(data).length === 0) return errorResponse(400, "Nada que actualizar")

    await db.lesson.update({ where: { id }, data })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")
    const { id } = await ctx.params
    const lesson = await db.lesson.findUnique({ where: { id } })
    if (!lesson) return errorResponse(404, "Lección no encontrada")

    await db.lesson.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

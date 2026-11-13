// /api/admin/live — Gestión de transmisiones EN VIVO (header x-admin-key o rol ADMIN)
// GET: lista completa · POST: crear · PATCH: actualizar (status/urls/etc) · DELETE: eliminar
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import type { LiveSessionDTO } from "@/lib/types"

const STATUSES = new Set(["SCHEDULED", "LIVE", "ENDED"])
const MAX_IMAGE = 400_000 // dataURL ~400 KB

function toDTO(l: {
  id: string
  title: string
  description: string
  status: string
  scheduledAt: Date
  coverImage: string | null
  streamUrl: string | null
  replayUrl: string | null
  createdAt: Date
}): LiveSessionDTO {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    status: l.status as LiveSessionDTO["status"],
    scheduledAt: l.scheduledAt.toISOString(),
    coverImage: l.coverImage,
    streamUrl: l.streamUrl,
    replayUrl: l.replayUrl,
    createdAt: l.createdAt.toISOString(),
  }
}

function cleanUrl(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  if (!/^https?:\/\//i.test(t)) throw new ApiError(400, "Los enlaces deben empezar por http(s)://")
  return t.slice(0, 500)
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const lives = await db.liveSession.findMany({ orderBy: { scheduledAt: "desc" }, take: 100 })
    return Response.json({ lives: lives.map(toDTO) })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const title = String(body.title ?? "").trim()
    if (title.length < 3) throw new ApiError(400, "El título debe tener al menos 3 caracteres")

    const description = String(body.description ?? "").trim().slice(0, 2000)
    const scheduledAtRaw = body.scheduledAt
    const scheduledAt = scheduledAtRaw ? new Date(String(scheduledAtRaw)) : new Date()
    if (Number.isNaN(scheduledAt.getTime())) throw new ApiError(400, "Fecha de transmisión inválida")

    const coverImage = typeof body.coverImage === "string" ? body.coverImage : null
    if (coverImage && coverImage.length > MAX_IMAGE) {
      throw new ApiError(400, "La imagen es demasiado grande (máx. ~400 KB)")
    }

    const live = await db.liveSession.create({
      data: {
        title: title.slice(0, 120),
        description,
        status: "SCHEDULED",
        scheduledAt,
        coverImage,
        streamUrl: cleanUrl(body.streamUrl),
        replayUrl: cleanUrl(body.replayUrl),
      },
    })
    return Response.json({ live: toDTO(live) }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = String(body.id ?? "")
    if (!id) throw new ApiError(400, "Falta el id de la transmisión")

    const live = await db.liveSession.findUnique({ where: { id } })
    if (!live) throw new ApiError(404, "Transmisión no encontrada")

    const data: Record<string, unknown> = {}

    if (body.status !== undefined) {
      const status = String(body.status)
      if (!STATUSES.has(status)) throw new ApiError(400, "Estado inválido")
      // Solo una transmisión EN VIVO a la vez: al activar, se finalizan las demás
      if (status === "LIVE") {
        await db.liveSession.updateMany({ where: { status: "LIVE" }, data: { status: "ENDED" } })
      }
      data.status = status
    }
    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (title.length < 3) throw new ApiError(400, "Título demasiado corto")
      data.title = title.slice(0, 120)
    }
    if (body.description !== undefined) data.description = String(body.description).trim().slice(0, 2000)
    if (body.scheduledAt !== undefined) {
      const d = new Date(String(body.scheduledAt))
      if (Number.isNaN(d.getTime())) throw new ApiError(400, "Fecha inválida")
      data.scheduledAt = d
    }
    if (body.coverImage !== undefined) {
      const img = body.coverImage === null ? null : String(body.coverImage)
      if (img && img.length > MAX_IMAGE) throw new ApiError(400, "Imagen demasiado grande")
      data.coverImage = img
    }
    if (body.streamUrl !== undefined) data.streamUrl = cleanUrl(body.streamUrl)
    if (body.replayUrl !== undefined) data.replayUrl = cleanUrl(body.replayUrl)

    const updated = await db.liveSession.update({ where: { id }, data })
    return Response.json({ live: toDTO(updated) })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")
    const id = new URL(req.url).searchParams.get("id")
    if (!id) throw new ApiError(400, "Falta el id")
    const live = await db.liveSession.findUnique({ where: { id } })
    if (!live) throw new ApiError(404, "Transmisión no encontrada")
    await db.liveSession.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

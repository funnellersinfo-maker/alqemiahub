// POST /api/posts — Crear publicación (texto + imagen opcional) con XP
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { awardXpFor } from "@/lib/gamification"
import { toFeedPost, type FeedPostWithInclude } from "@/lib/feed"
import type { XpEvent } from "@/lib/types"

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser()
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    const content = typeof body.content === "string" ? body.content.trim() : ""
    if (content.length === 0) return errorResponse(400, "La publicación no puede estar vacía")
    if (content.length > 2000) return errorResponse(400, "Máximo 2000 caracteres")

    let image: string | undefined
    if (typeof body.image === "string" && body.image.length > 0) {
      if (!body.image.startsWith("data:image/") || body.image.length > 400_000) {
        return errorResponse(400, "Imagen inválida o demasiado grande")
      }
      image = body.image
    }

    const created = await db.post.create({
      data: { userId: user.id, content, ...(image ? { image } : {}) },
    })

    // XP tras registrar la acción (logros incluidos)
    const xp: XpEvent | null = await awardXpFor(user.id, "post")

    // Reconstrucción del post con el include estándar (recién creado: 0 likes/comentarios)
    const postWithInclude: FeedPostWithInclude = {
      ...created,
      user: { ...user, xp: xp?.totalXp ?? user.xp },
      _count: { likes: 0, comments: 0 },
      likes: [],
    }

    return Response.json(
      { post: toFeedPost(postWithInclude, user.id), xp },
      { status: 201 }
    )
  } catch (e) {
    return handleApiError(e)
  }
}

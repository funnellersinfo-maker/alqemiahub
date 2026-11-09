// GET / POST /api/posts/[id]/comments — Comentarios de un post
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { awardXpFor } from "@/lib/gamification"
import type { FeedComment, XpEvent } from "@/lib/types"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireActiveUser()

    const comments = await db.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    })

    const mapped: FeedComment[] = comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: {
        id: c.user.id,
        name: c.user.name,
        image: c.user.image,
        avatarColor: c.user.avatarColor,
        headline: c.user.headline,
        xp: c.user.xp,
      },
    }))

    return Response.json({ comments: mapped })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireActiveUser()
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    const content = typeof body.content === "string" ? body.content.trim() : ""
    if (content.length === 0) return errorResponse(400, "El comentario no puede estar vacío")
    if (content.length > 1000) return errorResponse(400, "Máximo 1000 caracteres")

    const post = await db.post.findUnique({ where: { id }, select: { id: true } })
    if (!post) return errorResponse(404, "Publicación no encontrada")

    const created = await db.comment.create({
      data: { postId: id, userId: user.id, content },
    })

    // XP tras registrar la acción
    const xp: XpEvent | null = await awardXpFor(user.id, "comment")

    const comment: FeedComment = {
      id: created.id,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        image: user.image,
        avatarColor: user.avatarColor,
        headline: user.headline,
        xp: xp?.totalXp ?? user.xp,
      },
    }

    return Response.json({ comment, xp }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

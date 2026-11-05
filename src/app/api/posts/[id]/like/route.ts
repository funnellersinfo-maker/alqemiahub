// POST /api/posts/[id]/like — Dar o quitar like al post
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireActiveUser()

    const post = await db.post.findUnique({ where: { id }, select: { id: true } })
    if (!post) return errorResponse(404, "Publicación no encontrada")

    const existing = await db.like.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    })

    let liked: boolean
    if (existing) {
      await db.like.delete({ where: { id: existing.id } })
      liked = false
    } else {
      await db.like.create({ data: { postId: id, userId: user.id } })
      liked = true
    }

    const likeCount = await db.like.count({ where: { postId: id } })
    return Response.json({ liked, likeCount })
  } catch (e) {
    return handleApiError(e)
  }
}

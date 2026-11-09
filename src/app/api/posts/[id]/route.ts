// DELETE /api/posts/[id] — Eliminar publicación (autor o admin)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { isAdminRequest } from "@/lib/admin"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireUser()

    const post = await db.post.findUnique({ where: { id } })
    if (!post) return errorResponse(404, "Publicación no encontrada")

    if (post.userId !== user.id && !isAdminRequest(req)) {
      return errorResponse(403, "No tienes permiso para eliminar esta publicación")
    }

    try {
      // onDelete: Cascade del schema (Prisma lo aplica a nivel cliente en SQLite)
      await db.post.delete({ where: { id } })
    } catch {
      // Plan B: cascada manual (hijos antes que el post)
      await db.comment.deleteMany({ where: { postId: id } })
      await db.like.deleteMany({ where: { postId: id } })
      await db.post.delete({ where: { id } })
    }

    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

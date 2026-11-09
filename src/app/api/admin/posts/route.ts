// GET /api/admin/posts — Últimas publicaciones del muro con email del autor (header x-admin-key)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError } from "@/lib/api-helpers"
import { feedInclude, toFeedPost } from "@/lib/feed"

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) return errorResponse(401, "No autorizado")

    const posts = await db.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: feedInclude,
    })

    return Response.json({
      posts: posts.map((p) => ({
        ...toFeedPost(p, null),
        authorEmail: p.user.email,
      })),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

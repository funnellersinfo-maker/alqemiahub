// GET /api/feed — Muro social paginado por cursor (postId)
import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { feedInclude, toFeedPost } from "@/lib/feed"
import type { FeedResponse } from "@/lib/types"

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser()

    const searchParams = new URL(req.url).searchParams
    const cursor = searchParams.get("cursor")
    const limitRaw = Number.parseInt(searchParams.get("limit") ?? "10", 10)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : 10

    let where: Prisma.PostWhereInput | undefined
    if (cursor) {
      const cursorPost = await db.post.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      })
      if (!cursorPost) return errorResponse(400, "Cursor inválido")
      // Keyset pagination estable: createdAt desc + id desc
      where = {
        OR: [
          { createdAt: { lt: cursorPost.createdAt } },
          {
            AND: [
              { createdAt: { equals: cursorPost.createdAt } },
              { id: { lt: cursor } },
            ],
          },
        ],
      }
    }

    const fetched = await db.post.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: feedInclude,
    })

    const hasMore = fetched.length > limit
    const page = fetched.slice(0, limit)
    const nextCursor = hasMore ? (fetched[limit - 1]?.id ?? null) : null

    const body: FeedResponse = {
      posts: page.map((p) => toFeedPost(p, user.id)),
      nextCursor,
    }
    return Response.json(body)
  } catch (e) {
    return handleApiError(e)
  }
}

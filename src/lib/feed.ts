// ============================================================
// ALQEMIRA HUB — Helper del muro social (mapeo post BD → FeedPost)
// Compartido por /api/feed, /api/posts y /api/admin/posts
// ============================================================

import type { Prisma } from "@prisma/client"
import type { FeedPost } from "@/lib/types"

/** Include estándar del muro: autor, contadores y likes (solo userId) */
export const feedInclude = {
  user: true,
  _count: { select: { likes: true, comments: true } },
  likes: { select: { userId: true } },
} satisfies Prisma.PostInclude

/** Post de BD consultado con feedInclude */
export type FeedPostWithInclude = Prisma.PostGetPayload<{ include: typeof feedInclude }>

/** Mapea un post (con feedInclude) al contrato FeedPost del frontend */
export function toFeedPost(post: FeedPostWithInclude, sessionUserId: string | null): FeedPost {
  return {
    id: post.id,
    content: post.content,
    image: post.image,
    createdAt: post.createdAt.toISOString(),
    user: {
      id: post.user.id,
      name: post.user.name,
      image: post.user.image,
      avatarColor: post.user.avatarColor,
      headline: post.user.headline,
      xp: post.user.xp,
    },
    likeCount: post._count.likes,
    likedByMe: post.likes.some((l) => l.userId === sessionUserId),
    commentCount: post._count.comments,
    isOwn: post.user.id === sessionUserId,
  }
}

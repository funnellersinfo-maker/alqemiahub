// ============================================================
// ALQEMIA HUB — Helper del muro social (mapeo post BD → FeedPost)
// Compartido por /api/feed, /api/posts y /api/admin/posts
// ============================================================

import type { Prisma } from "@prisma/client"
import type { FeedPost } from "@/lib/types"
import { signMediaUrl } from "@/lib/media-token"
import { isVerifiedUser } from "@/lib/verified"

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
      verified: isVerifiedUser(post.user),
      role: post.user.role === "ADMIN" ? "ADMIN" : "USER",
    },
    likeCount: post._count.likes,
    likedByMe: post.likes.some((l) => l.userId === sessionUserId),
    commentCount: post._count.comments,
    isOwn: post.user.id === sessionUserId,
    // Evidencia pública del avance real (reportada al publicar)
    metricRevenue: post.metricRevenue ?? null,
    metricOrders: post.metricOrders ?? null,
    metricRoas: post.metricRoas ?? null,
  }
}

/**
 * toFeedPost + firma de la imagen interna (posts/{uuid}.jpg en el
 * almacén de medios). Las imágenes del muro ya NO viajan como
 * dataURL gigantes: son archivos en R2 con enlace firmado → el
 * feed pesa kilobytes, no megabytes. (Los dataURL heredados pasan
 * tal cual.)
 */
export async function toFeedPostSigned(
  post: FeedPostWithInclude,
  sessionUserId: string | null
): Promise<FeedPost> {
  const base = toFeedPost(post, sessionUserId)
  return { ...base, image: await signMediaUrl(base.image) }
}

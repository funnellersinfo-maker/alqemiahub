// ============================================================
// EL GRIMORIO — mapper compartido CodeSnippet BD → CodeDTO
// ============================================================

import type { Prisma } from "@prisma/client"
import type { CodeDTO, CodeDetailDTO } from "@/lib/types"

/** Include estándar: dueño del código */
export const codeInclude = {
  user: true,
} satisfies Prisma.CodeSnippetInclude

export type CodeWithOwner = Prisma.CodeSnippetGetPayload<{ include: typeof codeInclude }>

/** Mapea un código (con dueño) al contrato del frontend */
export function toCodeDTO(
  c: CodeWithOwner,
  sessionUserId: string | null,
  forkTitles?: Map<string, string>
): CodeDTO {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    language: c.language,
    fileName: c.fileName,
    visibility: c.visibility,
    tags: c.tags,
    forksCount: c.forksCount,
    forkedFromId: c.forkedFromId,
    forkedFromTitle: c.forkedFromId ? forkTitles?.get(c.forkedFromId) ?? null : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    owner: {
      id: c.user.id,
      name: c.user.name,
      image: c.user.image,
      avatarColor: c.user.avatarColor,
      headline: c.user.headline,
      role: c.user.role === "ADMIN" ? "ADMIN" : "USER",
    },
    isMine: c.userId === sessionUserId,
  }
}

/** Mapea un código con su contenido completo (vista de detalle) */
export function toCodeDetailDTO(
  c: CodeWithOwner,
  sessionUserId: string | null,
  forkTitles?: Map<string, string>
): CodeDetailDTO {
  return { ...toCodeDTO(c, sessionUserId, forkTitles), content: c.content }
}

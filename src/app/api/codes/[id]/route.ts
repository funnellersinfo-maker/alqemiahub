// ============================================================
// EL GRIMORIO — /api/codes/[id]
// GET    → detalle (contenido incluido; privado = solo el dueño)
// PATCH  → editar (dueño): título, descripción, visibilidad, código…
// DELETE → eliminar (dueño)
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import { toCodeDetailDTO, codeInclude } from "@/lib/codes-mapper"

type Ctx = { params: Promise<{ id: string }> }

async function loadCode(id: string) {
  return db.codeSnippet.findUnique({ where: { id }, include: codeInclude })
}

/** Privado → solo el dueño puede verlo. Público → todo el gremio. */
function assertCanView(code: { userId: string; visibility: string }, viewerId: string) {
  if (code.visibility !== "PUBLIC" && code.userId !== viewerId) {
    throw new ApiError(404, "Código no encontrado")
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireActiveUser()
    const { id } = await ctx.params
    const code = await loadCode(id)
    if (!code) return errorResponse(404, "Código no encontrado")
    assertCanView(code, user.id)

    let forkTitles: Map<string, string> | undefined
    if (code.forkedFromId) {
      const original = await db.codeSnippet.findUnique({
        where: { id: code.forkedFromId },
        select: { id: true, title: true },
      })
      if (original) forkTitles = new Map([[original.id, original.title]])
    }

    return Response.json({ code: toCodeDetailDTO(code, user.id, forkTitles) })
  } catch (e) {
    return handleApiError(e)
  }
}

const MAX_CONTENT = 100_000
const LANG_RE = /^[a-z0-9+#]{1,16}$/i
const FILENAME_RE = /^[\w.\- ]{1,80}$/

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireActiveUser()
    const { id } = await ctx.params
    const code = await loadCode(id)
    if (!code) return errorResponse(404, "Código no encontrado")
    if (code.userId !== user.id) return errorResponse(403, "Solo el autor puede editar este código")

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const data: Record<string, string | number | null> = {}

    if (typeof body.title === "string") {
      const title = body.title.trim()
      if (title.length < 2 || title.length > 80) {
        return errorResponse(400, "El título debe tener entre 2 y 80 caracteres")
      }
      data.title = title
    }
    if (typeof body.description === "string") {
      data.description = body.description.trim().slice(0, 500)
    }
    if (typeof body.content === "string") {
      if (body.content.trim().length === 0) return errorResponse(400, "El código no puede estar vacío")
      if (body.content.length > MAX_CONTENT) {
        return errorResponse(400, "El código supera el límite de 100.000 caracteres")
      }
      data.content = body.content
    }
    if (typeof body.language === "string") {
      const language = body.language.trim().toLowerCase()
      if (!LANG_RE.test(language)) return errorResponse(400, "Lenguaje inválido")
      data.language = language
    }
    if (typeof body.fileName === "string") {
      const fileName = body.fileName.trim()
      if (!FILENAME_RE.test(fileName)) {
        return errorResponse(400, "Nombre de archivo inválido")
      }
      data.fileName = fileName
    }
    if (body.visibility === "PUBLIC" || body.visibility === "PRIVATE") {
      data.visibility = body.visibility
    }
    if (typeof body.tags === "string") {
      data.tags =
        body.tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0 && t.length <= 24)
          .slice(0, 8)
          .join(",") || null
    }

    if (Object.keys(data).length === 0) return errorResponse(400, "Nada que actualizar")

    await db.codeSnippet.update({ where: { id }, data })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireActiveUser()
    const { id } = await ctx.params
    const code = await loadCode(id)
    if (!code) return errorResponse(404, "Código no encontrado")
    if (code.userId !== user.id) return errorResponse(403, "Solo el autor puede eliminar este código")

    await db.codeSnippet.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

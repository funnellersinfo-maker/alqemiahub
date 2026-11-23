// ============================================================
// EL GRIMORIO — /api/codes
// Repositorio de códigos estilo GitHub: los alquimistas suben
// el código de sus creaciones (privado o público) y se almacena
// como un drive del gremio. Otros pueden bifurcarlo para reusarlo.
// GET  → lista (mis códigos + los públicos del gremio)
// POST → crear código
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import type { Prisma } from "@prisma/client"
import { toCodeDTO, codeInclude } from "@/lib/codes-mapper"

export async function GET() {
  try {
    const user = await requireActiveUser()

    const codes = await db.codeSnippet.findMany({
      where: {
        OR: [{ userId: user.id }, { visibility: "PUBLIC" }],
      },
      orderBy: { updatedAt: "desc" },
      include: codeInclude,
    })

    // Título del código original (para mostrar "bifurcado de X")
    const forkedIds = [...new Set(codes.map((c) => c.forkedFromId).filter((v): v is string => !!v))]
    const originals = forkedIds.length
      ? await db.codeSnippet.findMany({
          where: { id: { in: forkedIds } },
          select: { id: true, title: true },
        })
      : []
    const titleById = new Map(originals.map((o) => [o.id, o.title]))

    return Response.json({
      codes: codes.map((c) => toCodeDTO(c, user.id, titleById)),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

const MAX_CONTENT = 100_000 // ~100 KB de texto por código
const LANG_RE = /^[a-z0-9+#]{1,16}$/i
const FILENAME_RE = /^[\w.\- ]{1,80}$/

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser()
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (title.length < 2 || title.length > 80) {
      return errorResponse(400, "El título debe tener entre 2 y 80 caracteres")
    }
    const content = typeof body.content === "string" ? body.content : ""
    if (content.trim().length === 0) return errorResponse(400, "El código no puede estar vacío")
    if (content.length > MAX_CONTENT) {
      return errorResponse(400, "El código supera el límite de 100.000 caracteres")
    }

    const language = typeof body.language === "string" ? body.language.trim().toLowerCase() : "texto"
    if (!LANG_RE.test(language)) return errorResponse(400, "Lenguaje inválido")

    let fileName = typeof body.fileName === "string" ? body.fileName.trim() : ""
    if (fileName === "") fileName = `codigo.${language === "texto" ? "txt" : language}`
    if (!FILENAME_RE.test(fileName)) {
      return errorResponse(
        400,
        "El nombre del archivo solo admite letras, números, punto, guion y espacio (máx 80)"
      )
    }

    const visibility = body.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE"
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : ""
    const rawTags = typeof body.tags === "string" ? body.tags : ""
    const tags =
      rawTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 24)
        .slice(0, 8)
        .join(",") || null

    const created = await db.codeSnippet.create({
      data: {
        userId: user.id,
        title,
        description,
        language,
        fileName,
        visibility,
        content,
        tags,
      },
    })

    return Response.json({ code: { id: created.id } }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

export type _PrismaUnused = Prisma.PostWhereInput // evita import sin uso en algunos entornos

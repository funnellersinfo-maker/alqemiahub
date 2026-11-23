// ============================================================
// EL GRIMORIO — /api/codes/[id]/fork
// POST → bifurcar: copia el código público a MI grimorio para
// reutilizarlo y editarlo como mío (estilo fork de GitHub).
// La copia nace privada; el original suma +1 bifurcación.
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { codeInclude } from "@/lib/codes-mapper"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireActiveUser()
    const { id } = await ctx.params

    const original = await db.codeSnippet.findUnique({
      where: { id },
      include: codeInclude,
    })
    if (!original) return errorResponse(404, "Código no encontrado")

    // Privado → solo el dueño puede bifurcarlo
    if (original.visibility !== "PUBLIC" && original.userId !== user.id) {
      return errorResponse(404, "Código no encontrado")
    }
    if (original.userId === user.id) {
      return errorResponse(400, "Ya es tu código: edítalo directamente")
    }

    const fork = await db.$transaction([
      db.codeSnippet.create({
        data: {
          userId: user.id,
          title: original.title,
          description: original.description,
          language: original.language,
          fileName: original.fileName,
          visibility: "PRIVATE",
          content: original.content,
          tags: original.tags,
          forkedFromId: original.id,
        },
      }),
      db.codeSnippet.update({
        where: { id: original.id },
        data: { forksCount: { increment: 1 } },
      }),
    ])

    return Response.json({ code: { id: fork[0].id } }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

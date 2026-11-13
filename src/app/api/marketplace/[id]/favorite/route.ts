// POST /api/marketplace/[id]/favorite — Agregar/quitar de mis Aliados (toggle)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError } from "@/lib/api-helpers"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await ctx.params

    const product = await db.product.findUnique({ where: { id } })
    if (!product) throw new ApiError(404, "Producto no encontrado")
    if (product.sellerId === me.id) throw new ApiError(400, "Es tu propio producto: ya lo vendes directamente")

    const existing = await db.productFavorite.findUnique({
      where: { userId_productId: { userId: me.id, productId: id } },
    })

    if (existing) {
      await db.productFavorite.delete({ where: { id: existing.id } })
      return Response.json({ isAlly: false })
    }
    await db.productFavorite.create({ data: { userId: me.id, productId: id } })
    return Response.json({ isAlly: true })
  } catch (e) {
    return handleApiError(e)
  }
}

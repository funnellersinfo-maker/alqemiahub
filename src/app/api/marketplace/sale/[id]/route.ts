// PATCH /api/marketplace/sale/[id] — Confirmar una venta de un aliado (solo el creador del producto)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError, errorResponse } from "@/lib/api-helpers"

export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await ctx.params

    const sale = await db.sale.findUnique({ where: { id }, include: { product: true } })
    if (!sale) throw new ApiError(404, "Venta no encontrada")
    if (sale.product.sellerId !== me.id) {
      return errorResponse(403, "Solo el creador del producto puede confirmar esta venta")
    }
    if (sale.status === "CONFIRMED") return Response.json({ ok: true, status: "CONFIRMED" })

    await db.sale.update({ where: { id }, data: { status: "CONFIRMED" } })
    return Response.json({ ok: true, status: "CONFIRMED" })
  } catch (e) {
    return handleApiError(e)
  }
}

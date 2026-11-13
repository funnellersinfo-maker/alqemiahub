// /api/marketplace/[id]/sales — POST: registrar venta (aliado o creador) · GET: ventas del producto (creador)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError, errorResponse } from "@/lib/api-helpers"
import type { SaleDTO } from "@/lib/types"

const MAX_PROOF = 400_000

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await ctx.params

    const product = await db.product.findUnique({ where: { id } })
    if (!product) throw new ApiError(404, "Producto no encontrado")

    // Puede registrar ventas el creador o cualquier aliado que lo tenga en favoritos
    if (product.sellerId !== me.id) {
      const fav = await db.productFavorite.findUnique({
        where: { userId_productId: { userId: me.id, productId: id } },
      })
      if (!fav) throw new ApiError(403, "Agrega este producto a tus Aliados antes de registrar ventas")
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const buyerName = String(body.buyerName ?? "").trim()
    if (buyerName.length < 2) throw new ApiError(400, "Escribe el nombre del comprador")

    const amount = Number(body.amount ?? product.price)
    if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, "Monto inválido")

    const proofImage = typeof body.proofImage === "string" ? body.proofImage : null
    if (proofImage && proofImage.length > MAX_PROOF) {
      throw new ApiError(400, "La imagen del comprobante es demasiado grande (máx. ~400 KB)")
    }

    const commission = Math.round(((amount * product.commissionPct) / 100) * 100) / 100
    const isOwner = product.sellerId === me.id

    const sale = await db.sale.create({
      data: {
        productId: id,
        resellerId: me.id,
        buyerName: buyerName.slice(0, 80),
        buyerContact: String(body.buyerContact ?? "").trim().slice(0, 120) || null,
        amount: Math.round(amount * 100) / 100,
        currency: product.currency,
        // El creador no se paga comisión a sí mismo
        commission: isOwner ? 0 : commission,
        proofImage,
        note: String(body.note ?? "").trim().slice(0, 300) || null,
        // Si el creador registra una venta directa queda confirmada de una vez
        status: isOwner ? "CONFIRMED" : "PENDING",
      },
    })

    return Response.json(
      { sale: { id: sale.id, status: sale.status, commission: sale.commission } },
      { status: 201 }
    )
  } catch (e) {
    return handleApiError(e)
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await ctx.params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) throw new ApiError(404, "Producto no encontrado")
    if (product.sellerId !== me.id) return errorResponse(403, "Solo el creador ve las ventas del producto")

    const sales = await db.sale.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { reseller: { select: { id: true, name: true, image: true, avatarColor: true } } },
    })

    const toDTO = (s: (typeof sales)[number]): SaleDTO => ({
      id: s.id,
      productId: s.productId,
      productTitle: product.title,
      buyerName: s.buyerName,
      buyerContact: s.buyerContact,
      amount: s.amount,
      currency: s.currency,
      commission: s.commission,
      proofImage: s.proofImage,
      note: s.note,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      reseller: s.reseller,
    })

    return Response.json({ sales: sales.map(toDTO) })
  } catch (e) {
    return handleApiError(e)
  }
}

// /api/marketplace/[id] — GET: detalle (+1 vista) · PATCH: editar (dueño) · DELETE: eliminar (dueño)
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError, errorResponse } from "@/lib/api-helpers"
import { toProductDTO } from "@/app/api/marketplace/route"

const MAX_IMAGE = 350_000

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await ctx.params

    const p = await db.product.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, image: true, avatarColor: true, headline: true } },
        _count: { select: { favorites: true, sales: true } },
      },
    })
    if (!p) throw new ApiError(404, "Producto no encontrado")

    // +1 vista (fire-and-forget)
    void db.product.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {})

    const isAlly = Boolean(
      await db.productFavorite.findUnique({ where: { userId_productId: { userId: me.id, productId: id } } })
    )

    return Response.json({
      product: toProductDTO(
        { ...p, views: p.views + 1 } as Parameters<typeof toProductDTO>[0],
        me.id,
        isAlly,
        p.sellerId === me.id || isAlly
      ),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await ctx.params
    const p = await db.product.findUnique({ where: { id } })
    if (!p) throw new ApiError(404, "Producto no encontrado")
    if (p.sellerId !== me.id) return errorResponse(403, "Solo el creador puede editar este producto")

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (title.length < 3) throw new ApiError(400, "Título demasiado corto")
      data.title = title.slice(0, 120)
    }
    if (body.description !== undefined) data.description = String(body.description).trim().slice(0, 4000)
    if (body.price !== undefined) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price < 0) throw new ApiError(400, "Precio inválido")
      data.price = Math.round(price * 100) / 100
    }
    if (body.commissionPct !== undefined) {
      const pct = Math.round(Number(body.commissionPct))
      if (!Number.isFinite(pct) || pct < 0 || pct > 90) throw new ApiError(400, "Comisión inválida (0-90%)")
      data.commissionPct = pct
    }
    if (body.status !== undefined) {
      const st = String(body.status)
      if (!["ACTIVE", "PAUSED"].includes(st)) throw new ApiError(400, "Estado inválido")
      data.status = st
    }
    if (body.coverImage !== undefined) {
      const img = body.coverImage === null ? null : String(body.coverImage)
      if (img && img.length > MAX_IMAGE) throw new ApiError(400, "Imagen demasiado grande")
      data.coverImage = img
    }
    if (body.contentUrl !== undefined) {
      const url = String(body.contentUrl).trim()
      if (url && !/^https?:\/\//i.test(url)) throw new ApiError(400, "Enlace inválido")
      data.contentUrl = url ? url.slice(0, 500) : null
    }

    await db.product.update({ where: { id }, data })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { id } = await ctx.params
    const p = await db.product.findUnique({ where: { id } })
    if (!p) throw new ApiError(404, "Producto no encontrado")
    if (p.sellerId !== me.id) return errorResponse(403, "Solo el creador puede eliminar este producto")
    await db.product.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

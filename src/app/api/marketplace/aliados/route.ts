// GET /api/marketplace/aliados — Métricas del negocio del miembro:
// como aliado (qué revendo, mis ventas y comisiones) y como creador
// (quiénes revenden mis productos, cuánto venden y cuánto ganan).
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError } from "@/lib/api-helpers"
import type { AllyMetrics, SaleDTO } from "@/lib/types"

function toSaleDTO(
  s: {
    id: string
    productId: string
    buyerName: string
    buyerContact: string | null
    amount: number
    currency: string
    commission: number
    proofImage: string | null
    note: string | null
    status: string
    createdAt: Date
    reseller: { id: string; name: string; image: string | null; avatarColor: string | null }
    product: { title: string }
  }
): SaleDTO {
  return {
    id: s.id,
    productId: s.productId,
    productTitle: s.product.title,
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
  }
}

export async function GET() {
  try {
    const me = await requireActiveUser()

    // ----- Como ALIADO: mis ventas -----
    const mySales = await db.sale.findMany({
      where: { resellerId: me.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        product: { select: { title: true } },
        reseller: { select: { id: true, name: true, image: true, avatarColor: true } },
      },
    })

    const confirmed = mySales.filter((s) => s.status === "CONFIRMED")
    const asAlly: AllyMetrics["asAlly"] = {
      totalSales: mySales.length,
      confirmedSales: confirmed.length,
      pendingSales: mySales.length - confirmed.length,
      commissionEarned: Math.round(confirmed.reduce((acc, s) => acc + s.commission, 0) * 100) / 100,
      recentSales: mySales.slice(0, 10).map(toSaleDTO),
    }

    // ----- Como CREADOR: mis productos y quién los revende -----
    const products = await db.product.findMany({
      where: { sellerId: me.id },
      orderBy: { createdAt: "desc" },
      include: {
        favorites: { include: { user: { select: { id: true, name: true, image: true, avatarColor: true } } } },
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            product: { select: { title: true } },
            reseller: { select: { id: true, name: true, image: true, avatarColor: true } },
          },
        },
      },
    })

    const asCreator: AllyMetrics["asCreator"] = {
      totalProducts: products.length,
      totalSales: products.reduce((acc, p) => acc + p.sales.length, 0),
      revenue:
        Math.round(
          products.reduce(
            (acc, p) => acc + p.sales.filter((s) => s.status === "CONFIRMED").reduce((a, s) => a + s.amount, 0),
            0
          ) * 100
        ) / 100,
      paidToAllies:
        Math.round(
          products.reduce(
            (acc, p) => acc + p.sales.filter((s) => s.status === "CONFIRMED").reduce((a, s) => a + s.commission, 0),
            0
          ) * 100
        ) / 100,
      products: products.map((p) => {
        const confirmedSales = p.sales.filter((s) => s.status === "CONFIRMED")
        // Agrupar ventas por aliado
        const byAlly = new Map<string, { salesCount: number; revenue: number; commission: number }>()
        for (const s of p.sales) {
          if (s.resellerId === me.id) continue // ventas directas del creador
          const cur = byAlly.get(s.resellerId) ?? { salesCount: 0, revenue: 0, commission: 0 }
          cur.salesCount += 1
          if (s.status === "CONFIRMED") {
            cur.revenue += s.amount
            cur.commission += s.commission
          }
          byAlly.set(s.resellerId, cur)
        }
        const allies = p.favorites
          .map((f) => {
            const stats = byAlly.get(f.userId) ?? { salesCount: 0, revenue: 0, commission: 0 }
            return {
              id: f.user.id,
              name: f.user.name,
              image: f.user.image,
              avatarColor: f.user.avatarColor,
              salesCount: stats.salesCount,
              revenue: Math.round(stats.revenue * 100) / 100,
              commission: Math.round(stats.commission * 100) / 100,
            }
          })
          .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue)

        const views = Math.max(1, p.views)
        return {
          id: p.id,
          title: p.title,
          category: p.category,
          price: p.price,
          currency: p.currency,
          views: p.views,
          salesCount: p.sales.length,
          conversionPct: Math.min(100, Math.round((p.sales.length / views) * 100)),
          allies,
          pendingSales: p.sales
            .filter((s) => s.status === "PENDING")
            .slice(0, 20)
            .map(toSaleDTO),
        }
      }),
    }

    const res: AllyMetrics = { asAlly, asCreator }
    return Response.json(res)
  } catch (e) {
    return handleApiError(e)
  }
}

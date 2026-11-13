// /api/marketplace — GET: explorar productos · POST: publicar producto
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError, ApiError } from "@/lib/api-helpers"
import type { ProductDTO } from "@/lib/types"

const CATEGORIES = new Set(["MICRO_APP", "DIGITAL", "PHYSICAL", "SERVICE"])
const MAX_IMAGE = 350_000

type ProductRow = {
  id: string
  title: string
  description: string
  category: string
  price: number
  currency: string
  commissionPct: number
  recurring: boolean
  coverImage: string | null
  contentUrl: string | null
  status: string
  views: number
  createdAt: Date
  sellerId: string
  seller: { id: string; name: string; image: string | null; avatarColor: string | null; headline: string | null }
  _count?: { favorites: number; sales: number }
}

export function toProductDTO(p: ProductRow, meId: string, isAlly: boolean, includeContent: boolean): ProductDTO {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency,
    commissionPct: p.commissionPct,
    recurring: p.recurring,
    coverImage: p.coverImage,
    contentUrl: includeContent ? p.contentUrl : null,
    status: p.status,
    views: p.views,
    createdAt: p.createdAt.toISOString(),
    seller: p.seller,
    isMine: p.sellerId === meId,
    isAlly,
    alliesCount: p._count?.favorites ?? 0,
    salesCount: p._count?.sales ?? 0,
  }
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category") ?? ""
    const mine = searchParams.get("mine") === "1"

    const products = await db.product.findMany({
      where: {
        ...(category && CATEGORIES.has(category) ? { category } : {}),
        ...(mine ? { sellerId: me.id } : { status: "ACTIVE" }),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        seller: { select: { id: true, name: true, image: true, avatarColor: true, headline: true } },
        _count: { select: { favorites: true, sales: true } },
      },
    })

    const myFavs = await db.productFavorite.findMany({
      where: { userId: me.id },
      select: { productId: true },
    })
    const favSet = new Set(myFavs.map((f) => f.productId))

    return Response.json({
      products: products.map((p) =>
        toProductDTO(
          p as ProductRow,
          me.id,
          favSet.has(p.id),
          p.sellerId === me.id || favSet.has(p.id) // contenido solo para dueño y aliados
        )
      ),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const title = String(body.title ?? "").trim()
    if (title.length < 3) throw new ApiError(400, "El título debe tener al menos 3 caracteres")

    const category = String(body.category ?? "")
    if (!CATEGORIES.has(category)) throw new ApiError(400, "Categoría inválida")

    const price = Number(body.price ?? 0)
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) throw new ApiError(400, "Precio inválido")

    const commissionPct = Math.round(Number(body.commissionPct ?? 50))
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 90) {
      throw new ApiError(400, "La comisión de aliados debe estar entre 0% y 90%")
    }

    const contentUrl = typeof body.contentUrl === "string" ? body.contentUrl.trim() : ""
    if (contentUrl && !/^https?:\/\//i.test(contentUrl)) {
      throw new ApiError(400, "El enlace del material debe empezar por http(s)://")
    }

    const coverImage = typeof body.coverImage === "string" ? body.coverImage : null
    if (coverImage && coverImage.length > MAX_IMAGE) {
      throw new ApiError(400, "La imagen de portada es demasiado grande (máx. ~350 KB)")
    }

    const product = await db.product.create({
      data: {
        sellerId: me.id,
        title: title.slice(0, 120),
        description: String(body.description ?? "").trim().slice(0, 4000),
        category,
        price: Math.round(price * 100) / 100,
        currency: ["USD", "EUR", "COP", "MXN", "ARS", "PEN", "CLP"].includes(String(body.currency)) ? String(body.currency) : "USD",
        commissionPct,
        recurring: Boolean(body.recurring),
        coverImage,
        contentUrl: contentUrl ? contentUrl.slice(0, 500) : null,
        status: "ACTIVE",
      },
    })

    return Response.json({ product: { id: product.id } }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

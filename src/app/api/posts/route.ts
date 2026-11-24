// POST /api/posts — Crear publicación (texto + imagen + métricas de evidencia) con XP
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"
import { awardXpFor } from "@/lib/gamification"
import { toFeedPostSigned, type FeedPostWithInclude } from "@/lib/feed"
import type { XpEvent } from "@/lib/types"

// Rangos válidos de las métricas de evidencia (reportes del período)
const MAX_REVENUE = 10_000_000 // USD
const MAX_ORDERS = 100_000
const MAX_ROAS = 100

/**
 * Parsea una métrica opcional del body.
 * Vacío/ausente → null. Presente pero inválida (no finita o fuera de rango) → 400.
 */
function parseMetric(raw: unknown, label: string, max: number): number | null {
  if (raw === undefined || raw === null || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) {
    throw new ApiError(400, `${label} debe ser un número válido`)
  }
  if (n < 0 || n > max) {
    throw new ApiError(400, `${label} debe estar entre 0 y ${max}`)
  }
  return n
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser()
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    const content = typeof body.content === "string" ? body.content.trim() : ""
    if (content.length === 0) return errorResponse(400, "La publicación no puede estar vacía")
    if (content.length > 2000) return errorResponse(400, "Máximo 2000 caracteres")

    let image: string | undefined
    if (typeof body.image === "string" && body.image.length > 0) {
      // Nueva vía: URL interna del almacén de medios (posts/…)
      const isMediaUrl =
        body.image.startsWith("/api/media/posts/") &&
        /^\/api\/media\/[A-Za-z0-9._/-]+$/.test(body.image) &&
        body.image.length <= 200
      // Vía heredada: dataURL
      const isDataUrl = body.image.startsWith("data:image/") && body.image.length <= 400_000
      if (!isMediaUrl && !isDataUrl) {
        return errorResponse(400, "Imagen inválida o demasiado grande")
      }
      image = body.image
    }

    // ---- Métricas de evidencia (facturación / pedidos / ROAS) ----
    const revenueRaw = parseMetric(body.metricRevenue, "La facturación", MAX_REVENUE)
    const ordersRaw = parseMetric(body.metricOrders, "Los pedidos", MAX_ORDERS)
    const roasRaw = parseMetric(body.metricRoas, "El ROAS", MAX_ROAS)

    // 0 o vacío no cuenta como evidencia → se guarda como null
    const metricRevenue =
      revenueRaw !== null && revenueRaw > 0 ? Math.round(revenueRaw * 100) / 100 : null
    const metricOrders = ordersRaw !== null && ordersRaw > 0 ? Math.round(ordersRaw) : null
    const metricRoas = roasRaw !== null && roasRaw > 0 ? Math.round(roasRaw * 10) / 10 : null

    const hasMetrics = metricRevenue !== null || metricOrders !== null || metricRoas !== null

    const created = await db.post.create({
      data: {
        userId: user.id,
        content,
        ...(image ? { image } : {}),
        ...(metricRevenue !== null ? { metricRevenue } : {}),
        ...(metricOrders !== null ? { metricOrders } : {}),
        ...(metricRoas !== null ? { metricRoas } : {}),
      },
    })

    // XP tras registrar la acción (logros incluidos).
    // Post con métricas → +5 (post) y El Evaluador valora la evidencia.
    const postXp: XpEvent | null = await awardXpFor(user.id, "post")
    const reportXp: XpEvent | null = hasMetrics
      ? await awardXpFor(user.id, "report", {
          evidence: {
            revenue: metricRevenue,
            orders: metricOrders,
            roas: metricRoas,
            hasImage: Boolean(image),
          },
        })
      : null

    let xp: XpEvent | null
    if (postXp && reportXp) {
      // El reporte se otorga al final: su totalXp/level ya acumulan ambos premios.
      // Sumamos los XP otorgados y conservamos el logro del post si el reporte no trae uno.
      xp = {
        ...reportXp,
        awarded: postXp.awarded + reportXp.awarded,
        achievement: reportXp.achievement ?? postXp.achievement,
      }
    } else {
      xp = reportXp ?? postXp
    }

    // Reconstrucción del post con el include estándar (recién creado: 0 likes/comentarios)
    const postWithInclude: FeedPostWithInclude = {
      ...created,
      user: { ...user, xp: xp?.totalXp ?? user.xp },
      _count: { likes: 0, comments: 0 },
      likes: [],
    }

    return Response.json(
      { post: await toFeedPostSigned(postWithInclude, user.id), xp },
      { status: 201 }
    )
  } catch (e) {
    return handleApiError(e)
  }
}

// ============================================================
// /api/admin/courses — EL ESTUDIO (gestión tipo YouTube Studio)
// GET  → programas con sus lecciones (para el panel del titular)
// POST → crear programa
// PATCH/DELETE → /api/admin/courses/[id]
// Lecciones → /api/admin/lessons y /api/admin/lessons/[id]
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")

    const courses = await db.course.findMany({
      orderBy: { order: "asc" },
      include: { lessons: { orderBy: { order: "asc" } } },
    })

    return Response.json({
      courses: courses.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        level: c.level,
        cover: c.cover,
        order: c.order,
        createdAt: c.createdAt.toISOString(),
        lessons: c.lessons.map((l) => ({
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl,
          durationMin: l.durationMin,
          order: l.order,
        })),
      })),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

const LEVELS = new Set(["Principiante", "Intermedio", "Avanzado"])

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (title.length < 3 || title.length > 120) {
      return errorResponse(400, "El título debe tener entre 3 y 120 caracteres")
    }
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : ""
    const level = typeof body.level === "string" && LEVELS.has(body.level) ? body.level : "Principiante"
    const cover =
      typeof body.cover === "string" && body.cover.length > 0
        ? body.cover
        : "/images/courses/ecommerce.png"
    if (!cover.startsWith("/") && !cover.startsWith("data:image/")) {
      return errorResponse(400, "Portada inválida (ruta interna o imagen)")
    }
    if (cover.length > 500_000) return errorResponse(400, "La portada es demasiado grande (máx ~400 KB)")

    // slug único: base + sufijo numérico si hace falta
    const base = slugify(title) || "programa"
    let slug = base
    let n = 2
     
    while (true) {
      const exists = await db.course.findUnique({ where: { slug } })
      if (!exists) break
      slug = `${base}-${n++}`
    }

    const order = typeof body.order === "number" ? Math.max(0, Math.floor(body.order)) : 0

    const created = await db.course.create({
      data: { slug, title, description, level, cover, order },
    })
    return Response.json({ course: { id: created.id, slug: created.slug } }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}

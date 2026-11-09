// GET /api/courses/[slug] — Detalle de un programa con lecciones y progreso
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireActiveUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import type { CourseDetail } from "@/lib/types"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const user = await requireActiveUser()

    const course = await db.course.findUnique({
      where: { slug },
      include: { lessons: { orderBy: { order: "asc" } } },
    })
    if (!course) return errorResponse(404, "Programa no encontrado")

    const lessonIds = course.lessons.map((l) => l.id)
    const progressRows = await db.lessonProgress.findMany({
      where: { userId: user.id, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    })
    const completedSet = new Set(progressRows.map((p) => p.lessonId))

    const detail: CourseDetail = {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      level: course.level,
      cover: course.cover,
      totalLessons: course.lessons.length,
      totalMinutes: course.lessons.reduce((sum, l) => sum + l.durationMin, 0),
      completedLessons: course.lessons.filter((l) => completedSet.has(l.id)).length,
      lessons: course.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        videoUrl: l.videoUrl,
        durationMin: l.durationMin,
        order: l.order,
        completed: completedSet.has(l.id),
      })),
    }

    return Response.json({ course: detail })
  } catch (e) {
    return handleApiError(e)
  }
}

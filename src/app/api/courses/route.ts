// GET /api/courses — Listado de programas con progreso del usuario
import { db } from "@/lib/db"
import { requireActiveUser, handleApiError } from "@/lib/api-helpers"
import type { CourseSummary } from "@/lib/types"

export async function GET() {
  try {
    const user = await requireActiveUser()

    const [courses, progressRows] = await Promise.all([
      db.course.findMany({
        orderBy: { order: "asc" },
        include: { lessons: { select: { id: true, durationMin: true } } },
      }),
      db.lessonProgress.findMany({
        where: { userId: user.id },
        select: { lessonId: true },
      }),
    ])

    const completedSet = new Set(progressRows.map((p) => p.lessonId))

    const summaries: CourseSummary[] = courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      level: c.level,
      cover: c.cover,
      totalLessons: c.lessons.length,
      totalMinutes: c.lessons.reduce((sum, l) => sum + l.durationMin, 0),
      completedLessons: c.lessons.filter((l) => completedSet.has(l.id)).length,
    }))

    return Response.json({ courses: summaries })
  } catch (e) {
    return handleApiError(e)
  }
}

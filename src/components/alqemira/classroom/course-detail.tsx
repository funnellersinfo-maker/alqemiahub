"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  GraduationCap,
  Play,
  PlayCircle,
} from "lucide-react"

import { EmptyState } from "@/components/alqemira/empty-state"
import { LessonView } from "@/components/alqemira/classroom/lesson-view"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import type { CourseDetail as CourseDetailData } from "@/lib/types"

type CourseResponse = { course: CourseDetailData }

async function fetchCourse(slug: string): Promise<CourseResponse> {
  const res = await fetch(`/api/courses/${slug}`)
  if (!res.ok) throw new Error("No se pudo cargar el programa")
  return (await res.json()) as CourseResponse
}

export function CourseDetail({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [lessonId, setLessonId] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ["course", slug],
    queryFn: () => fetchCourse(slug),
  })

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-0">
        <div className="space-y-4">
          <Skeleton className="aspect-[16/7] w-full rounded-2xl sm:aspect-[21/9]" />
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const course = data?.course

  if (!course) {
    return (
      <div className="mx-auto w-full max-w-5xl px-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-4">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a programas
        </Button>
        <EmptyState
          icon={GraduationCap}
          title="Programa no disponible"
          description="No pudimos cargar este programa. Vuelve a intentarlo en unos momentos."
        />
      </div>
    )
  }

  if (lessonId) {
    return <LessonView course={course} lessonId={lessonId} onBack={() => setLessonId(null)} />
  }

  const lessons = [...course.lessons].sort((a, b) => a.order - b.order)
  const pct =
    course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0
  const nextLesson = lessons.find((l) => !l.completed) ?? lessons[0] ?? null
  const ctaLabel =
    course.completedLessons === 0
      ? "Empezar programa"
      : course.completedLessons < course.totalLessons
        ? "Continuar programa"
        : "Repasar programa"

  return (
    <div className="mx-auto w-full max-w-5xl px-0">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-4">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a programas
      </Button>

      <Card className="gap-0 overflow-hidden rounded-2xl p-0">
        <div className="relative aspect-[16/7] sm:aspect-[21/9]">
          <img src={course.cover} alt={course.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <span className="rounded-full bg-zinc-950/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              {course.level}
            </span>
            <h1 className="mt-2 font-display text-xl font-semibold tracking-tight text-white drop-shadow sm:text-2xl">
              {course.title}
            </h1>
            <p className="mt-1 line-clamp-2 max-w-xl text-sm text-zinc-200">
              {course.description}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-300">
              <PlayCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{course.totalLessons} lecciones</span>
              <span aria-hidden>·</span>
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{course.totalMinutes} min</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {course.completedLessons > 0 && (
                <div className="w-full max-w-[220px] shrink-0 sm:w-auto">
                  <Progress
                    value={pct}
                    className="h-1.5 bg-white/20 [&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-amber-500"
                  />
                  <p className="mt-1 text-[11px] text-zinc-300">
                    {course.completedLessons} de {course.totalLessons} lecciones
                  </p>
                </div>
              )}
              {nextLesson && (
                <Button
                  size="sm"
                  onClick={() => setLessonId(nextLesson.id)}
                  className="shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  {ctaLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4 divide-y divide-zinc-100 gap-0 overflow-hidden rounded-2xl p-0">
        {lessons.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            onClick={() => setLessonId(lesson.id)}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-50/70"
          >
            {lesson.completed ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="h-4 w-4" aria-hidden />
              </span>
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-xs font-medium text-zinc-500">
                {lesson.order}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 text-sm font-medium text-zinc-900">
                {lesson.title}
                {lesson.completed && (
                  <span className="ml-1 inline text-[11px] font-medium text-emerald-600">
                    Completada
                  </span>
                )}
              </span>
              <span className="mt-0.5 hidden line-clamp-1 text-xs text-zinc-400 sm:block">
                {lesson.description}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-400">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {lesson.durationMin} min
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
          </button>
        ))}
      </Card>
    </div>
  )
}

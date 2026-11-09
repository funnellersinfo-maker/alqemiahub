"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Clock, GraduationCap, PlayCircle } from "lucide-react"

import { CourseDetail } from "@/components/alqemia/classroom/course-detail"
import { EmptyState } from "@/components/alqemia/empty-state"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import type { CourseSummary } from "@/lib/types"

type CoursesResponse = { courses: CourseSummary[] }

async function fetchCourses(): Promise<CoursesResponse> {
  const res = await fetch("/api/courses")
  if (!res.ok) throw new Error("No se pudieron cargar los programas")
  return (await res.json()) as CoursesResponse
}

const PROGRESS_CLASSES =
  "h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-gold [&>div]:to-gold-deep"

function CourseCard({
  course,
  onOpen,
}: {
  course: CourseSummary
  onOpen: () => void
}) {
  const pct =
    course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0

  return (
    <button type="button" onClick={onOpen} className="group w-full text-left">
      <Card className="h-full gap-0 overflow-hidden rounded-2xl p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-video overflow-hidden">
          <img
            src={course.cover}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-zinc-950/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            {course.level}
          </span>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-1 font-semibold leading-snug text-zinc-100">
            {course.title}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-zinc-500">
            {course.description}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <PlayCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{course.totalLessons} lecciones</span>
            <span aria-hidden>·</span>
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{course.totalMinutes} min</span>
          </div>
          {course.completedLessons > 0 ? (
            <div className="mt-3">
              <Progress value={pct} className={PROGRESS_CLASSES} />
              <p className="mt-1.5 text-xs text-zinc-500">
                {course.completedLessons} de {course.totalLessons} lecciones
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs font-medium text-gold">Empezar ahora</p>
          )}
        </div>
      </Card>
    </button>
  )
}

export function ClassroomView() {
  const [slug, setSlug] = useState<string | null>(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: ["courses"],
    queryFn: fetchCourses,
  })

  if (slug) {
    return <CourseDetail slug={slug} onBack={() => setSlug(null)} />
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-0">
      <header className="mb-4 sm:mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Classroom</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Programas de formación grabados de ALQEMIA. Aprende a tu ritmo.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-sm"
            >
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError || !data || data.courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Programas en camino"
          description="El equipo está preparando el siguiente programa."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onOpen={() => setSlug(course.slug)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

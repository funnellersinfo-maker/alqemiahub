"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { celebrateXp } from "@/lib/store"
import type { CourseDetail, XpEvent } from "@/lib/types"

type CompleteResponse = { ok: boolean; xp: XpEvent | null }

export function LessonView({
  course,
  lessonId,
  onBack,
}: {
  course: CourseDetail
  lessonId: string
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState(lessonId)
  const [completing, setCompleting] = useState(false)

  const lessons = [...course.lessons].sort((a, b) => a.order - b.order)
  const index = lessons.findIndex((l) => l.id === activeId)
  const lesson = index >= 0 ? lessons[index] : null

  if (!lesson) return null

  const markComplete = async () => {
    if (completing || lesson.completed) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/complete`, { method: "POST" })
      let json: CompleteResponse | null = null
      try {
        json = (await res.json()) as CompleteResponse
      } catch {
        json = null
      }
      if (!res.ok || !json) throw new Error("No se pudo completar la lección")
      celebrateXp(json.xp ?? null)
      await queryClient.invalidateQueries({ queryKey: ["course", course.slug] })
      await queryClient.invalidateQueries({ queryKey: ["courses"] })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
    } catch {
      toast.error("No se pudo marcar la lección. Inténtalo de nuevo.")
    } finally {
      setCompleting(false)
    }
  }

  const prev = index > 0 ? lessons[index - 1] : null
  const next = index < lessons.length - 1 ? lessons[index + 1] : null

  return (
    <div className="mx-auto w-full max-w-5xl px-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 mb-4 max-w-full"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="line-clamp-1">Volver a {course.title}</span>
      </Button>

      <Card className="gap-0 overflow-hidden rounded-2xl bg-zinc-950 p-0">
        {lesson.videoUrl ? (
          <video
            controls
            preload="metadata"
            poster={course.cover}
            src={lesson.videoUrl}
            className="aspect-video w-full bg-zinc-950"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-zinc-950 text-sm text-zinc-500">
            Video disponible próximamente
          </div>
        )}
      </Card>

      <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-zinc-100">
        {lesson.title}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">{lesson.description}</p>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {lesson.durationMin} min · Lección {lesson.order} de {lessons.length}
        </span>
      </div>

      <Card className="mt-4 flex-row items-center justify-between gap-3 rounded-2xl p-4">
        {lesson.completed ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <span className="text-sm font-medium text-emerald-700">Lección completada</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 shrink-0 text-gold-deep" aria-hidden />
            <span className="text-sm text-zinc-300">
              Completa esta lección y gana +25 XP
            </span>
          </div>
        )}
        {lesson.completed ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="shrink-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Check className="h-4 w-4" aria-hidden />
            Completada
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={markComplete}
            disabled={completing}
            className="shrink-0"
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            {completing ? "Completando..." : "Marcar como completada"}
          </Button>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!prev}
          onClick={() => prev && setActiveId(prev.id)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Anterior
        </Button>
        <Button size="sm" disabled={!next} onClick={() => next && setActiveId(next.id)}>
          Siguiente lección
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

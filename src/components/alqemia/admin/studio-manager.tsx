"use client"

// ============================================================
// ADMIN — EL ESTUDIO (gestión de programas y lecciones)
// Manager tipo YouTube Studio / hub Hotmart para el titular:
// lista de programas (portada, nivel, orden) a la izquierda y
// editor con lecciones (vídeo, duración, reordenar) a la derecha.
// ============================================================

import { useRef, useState, type ChangeEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronUp,
  Clapperboard,
  ImagePlus,
  Loader2,
  Lock,
  MonitorPlay,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Video,
  VideoOff,
} from "lucide-react"
import { toast } from "sonner"

import { useAppStore } from "@/lib/store"
import { compressImage } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/alqemia/empty-state"
import { adminFetch, isLockedError } from "@/components/alqemia/admin/admin-fetch"

// ============================================================
// Tipos y constantes
// ============================================================

const LEVELS = ["Principiante", "Intermedio", "Avanzado"] as const
type CourseLevel = (typeof LEVELS)[number]

type AdminLesson = {
  id: string
  courseId: string
  title: string
  description: string
  videoUrl: string | null
  durationMin: number
  order: number
}

type AdminCourse = {
  id: string
  slug: string
  title: string
  description: string
  level: CourseLevel
  cover: string
  order: number
  createdAt: string
  lessons: AdminLesson[]
}

/** Portada por defecto si el titular no sube ninguna al crear. */
const DEFAULT_COVER = "/images/courses/ecommerce.png"
/** Límite de ~400 KB para la portada comprimida (el backend rechaza más). */
const MAX_COVER_BYTES = 400 * 1024

// ============================================================
// Estados de query (mismo patrón que admin-view)
// ============================================================

function LockedNotice() {
  const setAdminGateOpen = useAppStore((s) => s.setAdminGateOpen)
  return (
    <Card className="gap-0 rounded-2xl p-0">
      <EmptyState
        icon={Lock}
        title="Sesión de admin finalizada"
        description="Vuelve a desbloquear el panel con tu clave."
        action={
          <Button variant="outline" size="sm" onClick={() => setAdminGateOpen(true)}>
            Desbloquear panel
          </Button>
        }
      />
    </Card>
  )
}

function QueryErrorView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Card className="gap-0 rounded-2xl p-0">
      <EmptyState
        icon={TriangleAlert}
        title="No se pudo cargar"
        description={error.message}
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        }
      />
    </Card>
  )
}

// ============================================================
// Piezas compartidas
// ============================================================

/** Miniatura 16:9 de portada (ruta interna "/..." o dataURL). */
function CoverThumb({ cover, alt }: { cover: string; alt: string }) {
  if (cover.startsWith("/") || cover.startsWith("data:")) {
    return <img src={cover} alt={alt} className="h-full w-full object-cover" />
  }
  return (
    <span className="flex h-full w-full items-center justify-center">
      <MonitorPlay className="h-4 w-4 text-zinc-600" aria-hidden />
    </span>
  )
}

/** Par de flechas para reordenar (intercambia el orden con el vecino). */
function OrderArrows({
  index,
  total,
  onMove,
  disabled,
  label,
}: {
  index: number
  total: number
  onMove: (dir: -1 | 1) => void
  disabled?: boolean
  label: string
}) {
  return (
    <span className="flex shrink-0 flex-col gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Subir ${label}`}
        title="Subir"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        className="h-6 w-6 rounded-md text-zinc-500 hover:text-zinc-200"
      >
        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Bajar ${label}`}
        title="Bajar"
        disabled={disabled || index === total - 1}
        onClick={() => onMove(1)}
        className="h-6 w-6 rounded-md text-zinc-500 hover:text-zinc-200"
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </span>
  )
}

// ============================================================
// Diálogo de lección (crear + editar)
// ============================================================

function LessonDialog({ courseId, lesson }: { courseId: string; lesson?: AdminLesson }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(lesson?.title ?? "")
  const [description, setDescription] = useState(lesson?.description ?? "")
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? "")
  const [duration, setDuration] = useState(String(lesson?.durationMin ?? 10))
  const isEdit = Boolean(lesson)

  function resetForm() {
    setTitle(lesson?.title ?? "")
    setDescription(lesson?.description ?? "")
    setVideoUrl(lesson?.videoUrl ?? "")
    setDuration(String(lesson?.durationMin ?? 10))
  }

  const saveMutation = useMutation({
    mutationFn: async (): Promise<{ ok: boolean } | { lesson: { id: string } }> => {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        videoUrl: videoUrl.trim() || null,
        durationMin: Math.round(Number(duration) || 10),
      }
      if (lesson) {
        return adminFetch<{ ok: boolean }>(`/api/admin/lessons/${lesson.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      }
      return adminFetch<{ lesson: { id: string } }>("/api/admin/lessons", {
        method: "POST",
        body: JSON.stringify({ courseId, ...payload }),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
      toast.success(isEdit ? "Lección actualizada" : "Lección añadida")
      setOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function submit() {
    const t = title.trim()
    if (t.length < 3 || t.length > 120) {
      toast.error("El título debe tener entre 3 y 120 caracteres")
      return
    }
    const url = videoUrl.trim()
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("La URL del vídeo debe empezar por http:// o https://")
      return
    }
    const mins = Math.round(Number(duration))
    if (!Number.isFinite(mins) || mins < 1 || mins > 600) {
      toast.error("La duración debe estar entre 1 y 600 minutos")
      return
    }
    saveMutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) resetForm()
      }}
    >
      {isEdit ? (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Editar lección ${lesson?.title ?? ""}`}
            title="Editar lección"
            className="h-8 w-8 border-zinc-700 text-zinc-400 hover:border-gold/40 hover:bg-gold/10 hover:text-gold-bright"
          >
            <Pencil aria-hidden />
          </Button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button type="button" size="sm" className="btn-gold h-8 px-3 text-xs font-semibold">
            <Plus aria-hidden /> Añadir lección
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lección" : "Nueva lección"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="lesson-title">Título</Label>
            <Input
              id="lesson-title"
              placeholder="Ej. Bienvenida y mapa del programa"
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lesson-desc">Descripción</Label>
            <Textarea
              id="lesson-desc"
              rows={3}
              maxLength={1000}
              placeholder="Qué verá el gremio en esta lección…"
              className="mt-2 resize-none border-zinc-800 bg-zinc-950/70"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lesson-video">Vídeo de la lección</Label>
            <Input
              id="lesson-video"
              placeholder="https://youtube.com/watch?v=… o https://…/video.mp4"
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <p className="mt-1.5 text-[11px] text-zinc-500">
              YouTube, Vimeo o MP4 directo. Puedes dejarlo vacío y añadirlo más tarde.
            </p>
          </div>
          <div>
            <Label htmlFor="lesson-duration">Duración (minutos)</Label>
            <Input
              id="lesson-duration"
              type="number"
              min={1}
              max={600}
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="btn-gold font-semibold"
            disabled={saveMutation.isPending}
            onClick={submit}
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isEdit ? "Guardar lección" : "Añadir lección"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Fila de lección
// ============================================================

function LessonRow({
  lesson,
  index,
  total,
  moving,
  onMove,
}: {
  lesson: AdminLesson
  index: number
  total: number
  moving?: boolean
  onMove: (dir: -1 | 1) => void
}) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean }>(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
      toast.success("Lección eliminada")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <li className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5">
      <span className="w-6 shrink-0 text-center text-xs font-semibold text-zinc-500">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-100">{lesson.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
          {lesson.videoUrl ? (
            <span className="inline-flex items-center gap-1 text-gold-deep">
              <Video className="h-3.5 w-3.5" aria-hidden /> Vídeo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-zinc-600">
              <VideoOff className="h-3.5 w-3.5" aria-hidden /> Sin vídeo
            </span>
          )}
          <span aria-hidden>·</span>
          <span>{lesson.durationMin} min</span>
        </span>
      </span>
      <OrderArrows
        index={index}
        total={total}
        onMove={onMove}
        disabled={moving}
        label={lesson.title}
      />
      <LessonDialog courseId={lesson.courseId} lesson={lesson} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Eliminar lección ${lesson.title}`}
            title="Eliminar lección"
            className="h-8 w-8 border-zinc-700 text-zinc-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Trash2 aria-hidden />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la lección «{lesson.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará junto con el progreso de los miembros en ella. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

// ============================================================
// Sección de lecciones del programa seleccionado
// ============================================================

function LessonsSection({ course }: { course: AdminCourse }) {
  const queryClient = useQueryClient()

  const reorderMutation = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const j = index + dir
      if (j < 0 || j >= course.lessons.length) return
      const a = course.lessons[index]
      const b = course.lessons[j]
      if (!a || !b) return
      // Intercambio de orden con el vecino (índice → orden)
      await adminFetch(`/api/admin/lessons/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ order: j }),
      })
      await adminFetch(`/api/admin/lessons/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ order: index }),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Card className="mt-4 gap-0 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-zinc-100">Lecciones</h4>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
            {course.lessons.length}
          </Badge>
        </div>
        <LessonDialog courseId={course.id} />
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Añade lecciones con su vídeo (YouTube, Vimeo o MP4) y su duración. Se mostrarán en el Aula
        de los miembros.
      </p>

      {course.lessons.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-xs text-zinc-500">
          Este programa aún no tiene lecciones. Pulsa «Añadir lección» para crear la primera.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {course.lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={i}
              total={course.lessons.length}
              moving={reorderMutation.isPending}
              onMove={(dir) => reorderMutation.mutate({ index: i, dir })}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

// ============================================================
// Editor de programa (crear / editar)
// ============================================================

function CourseEditor({
  course,
  defaultOrder = 0,
  onCreated,
  onCancel,
  onDeleted,
}: {
  /** null → modo crear */
  course: AdminCourse | null
  defaultOrder?: number
  onCreated?: (id: string) => void
  onCancel?: () => void
  onDeleted?: () => void
}) {
  const queryClient = useQueryClient()
  const isCreate = course === null
  const courseId = course?.id ?? ""

  const [title, setTitle] = useState(course?.title ?? "")
  const [description, setDescription] = useState(course?.description ?? "")
  const [level, setLevel] = useState<CourseLevel>(course?.level ?? "Principiante")
  const [order, setOrder] = useState(String(course?.order ?? defaultOrder))
  const [cover, setCover] = useState<string | null>(course?.cover ?? null)
  const [processingCover, setProcessingCover] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onCoverFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setProcessingCover(true)
    try {
      // Recorte centrado 16:9 + JPEG a ancho máx. 800 (FileReader → canvas)
      const dataUrl = await compressImage(file, { maxWidth: 800, aspect: 16 / 9, quality: 0.82 })
      const base64 = dataUrl.split(",")[1] ?? ""
      if (Math.floor((base64.length * 3) / 4) > MAX_COVER_BYTES) {
        toast.error("La portada supera los 400 KB tras comprimirla. Prueba con una más ligera.")
        return
      }
      setCover(dataUrl)
    } catch {
      toast.error("No se pudo procesar la imagen")
    } finally {
      setProcessingCover(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      adminFetch<{ course: { id: string } }>("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
      toast.success("Programa creado")
      onCreated?.(data.course.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      adminFetch<{ ok: boolean }>(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
      toast.success("Programa actualizado")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean }>(`/api/admin/courses/${courseId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
      toast.success("Programa eliminado")
      onDeleted?.()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function parsedOrder(): number {
    const n = Math.floor(Number(order))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  function submit() {
    const t = title.trim()
    if (t.length < 3 || t.length > 120) {
      toast.error("El título debe tener entre 3 y 120 caracteres")
      return
    }
    if (!course) {
      createMutation.mutate({
        title: t,
        description: description.trim(),
        level,
        cover: cover ?? DEFAULT_COVER,
        order: parsedOrder(),
      })
      return
    }
    // PATCH solo con los campos modificados
    const payload: Record<string, unknown> = {}
    if (t !== course.title) payload.title = t
    if (description.trim() !== course.description) payload.description = description.trim()
    if (level !== course.level) payload.level = level
    if (cover !== course.cover) payload.cover = cover
    if (parsedOrder() !== course.order) payload.order = parsedOrder()
    if (Object.keys(payload).length === 0) {
      toast.info("No hay cambios que guardar")
      return
    }
    updateMutation.mutate(payload)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <Card className="gap-0 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-zinc-100">
            {isCreate ? "Nuevo programa" : "Editar programa"}
          </h3>
          {isCreate && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          {/* Portada 16:9 */}
          <div>
            <Label>Portada 16:9</Label>
            <div className="relative mt-2 aspect-video max-h-44 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              {cover ? (
                <img
                  src={cover}
                  alt="Vista previa de la portada del programa"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-zinc-600">
                  <ImagePlus className="h-6 w-6" aria-hidden />
                  <p className="text-xs">Sin portada — se usará una por defecto</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onCoverFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute bottom-2 right-2 h-8 border-zinc-700 bg-zinc-950/80 backdrop-blur-sm"
                disabled={processingCover}
                onClick={() => fileRef.current?.click()}
              >
                {processingCover ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <ImagePlus aria-hidden />
                )}
                Cambiar portada
              </Button>
            </div>
          </div>

          {/* Título */}
          <div>
            <Label htmlFor="course-title">Título</Label>
            <Input
              id="course-title"
              placeholder="Ej. Embudos de venta que convierten"
              className="mt-2 border-zinc-800 bg-zinc-950/70"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Descripción */}
          <div>
            <Label htmlFor="course-desc">Descripción</Label>
            <Textarea
              id="course-desc"
              rows={3}
              maxLength={1000}
              placeholder="Qué aprenderá el gremio en este programa…"
              className="mt-2 resize-none border-zinc-800 bg-zinc-950/70"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Nivel + orden */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="course-level">Nivel</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as CourseLevel)}>
                <SelectTrigger
                  id="course-level"
                  className="mt-2 w-full border-zinc-800 bg-zinc-950/70"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-950">
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="course-order">Orden</Label>
              <Input
                id="course-order"
                type="number"
                min={0}
                className="mt-2 border-zinc-800 bg-zinc-950/70"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/70 pt-4">
            <Button
              type="button"
              className="btn-gold font-semibold"
              disabled={saving}
              onClick={submit}
            >
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : isCreate ? (
                <Plus aria-hidden />
              ) : null}
              {isCreate ? "Crear programa" : "Guardar cambios"}
            </Button>
            {!isCreate && course && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 aria-hidden />
                    )}
                    Eliminar programa
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar «{course.title}»?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminarán sus lecciones y el progreso de los miembros. Esta acción no se
                      puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white hover:bg-red-700"
                      onClick={() => deleteMutation.mutate()}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </Card>

      {/* Lecciones: solo para un programa ya guardado */}
      {course && <LessonsSection course={course} />}
    </div>
  )
}

// ============================================================
// Fila de programa (lista izquierda)
// ============================================================

function CourseRow({
  course,
  index,
  total,
  selected,
  onSelect,
  onMove,
  moving,
}: {
  course: AdminCourse
  index: number
  total: number
  selected: boolean
  onSelect: () => void
  onMove: (dir: -1 | 1) => void
  moving?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border p-2 transition-colors",
        selected ? "border-gold bg-gold/10" : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <span className="block aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
          <CoverThumb cover={course.cover} alt={`Portada de ${course.title}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-100">{course.title}</span>
          <span className="mt-0.5 block truncate text-xs text-zinc-500">
            {course.lessons.length} lecciones · {course.level}
          </span>
        </span>
      </button>
      <OrderArrows
        index={index}
        total={total}
        onMove={onMove}
        disabled={moving}
        label={course.title}
      />
    </div>
  )
}

// ============================================================
// EL ESTUDIO — vista principal
// ============================================================

export function StudioManager() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const query = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => adminFetch<{ courses: AdminCourse[] }>("/api/admin/courses"),
  })
  const courses = query.data?.courses ?? []
  const selected = selectedId ? (courses.find((c) => c.id === selectedId) ?? null) : null

  const reorderMutation = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const j = index + dir
      if (j < 0 || j >= courses.length) return
      const a = courses[index]
      const b = courses[j]
      if (!a || !b) return
      // Intercambio de orden con el vecino (índice → orden)
      await adminFetch(`/api/admin/courses/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ order: j }),
      })
      await adminFetch(`/api/admin/courses/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ order: index }),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (query.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="gap-0 rounded-2xl p-4">
          <Skeleton className="h-7 w-40" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[70px] w-full rounded-xl" />
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="gap-0 rounded-2xl p-4 sm:p-5">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="mt-4 aspect-video max-h-44 w-full rounded-xl" />
            <Skeleton className="mt-4 h-9 w-full" />
            <Skeleton className="mt-4 h-20 w-full" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (query.error) {
    if (isLockedError(query.error)) return <LockedNotice />
    return <QueryErrorView error={query.error} onRetry={() => void query.refetch()} />
  }

  const nextOrder = courses.length > 0 ? ((courses[courses.length - 1]?.order ?? 0) + 1) : 0

  function selectCourse(id: string) {
    setSelectedId(id)
    setCreatingNew(false)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* Columna izquierda: lista de programas */}
      <Card className="gap-0 self-start rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base font-semibold text-zinc-100">Programas</h3>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
            {courses.length}
          </Badge>
          <Button
            type="button"
            size="sm"
            className="btn-gold ml-auto h-8 px-3 text-xs font-semibold"
            onClick={() => {
              setCreatingNew(true)
              setSelectedId(null)
            }}
          >
            <Plus aria-hidden /> Nuevo
          </Button>
        </div>

        <div className="thin-scrollbar mt-3 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {courses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-8 text-center text-xs text-zinc-500">
              Aún no hay programas. Crea el primero con «Nuevo».
            </p>
          ) : (
            courses.map((course, i) => (
              <CourseRow
                key={course.id}
                course={course}
                index={i}
                total={courses.length}
                selected={course.id === selectedId && !creatingNew}
                onSelect={() => selectCourse(course.id)}
                onMove={(dir) => reorderMutation.mutate({ index: i, dir })}
                moving={reorderMutation.isPending}
              />
            ))
          )}
        </div>
      </Card>

      {/* Columna derecha: editor */}
      <div className="min-w-0">
        {creatingNew ? (
          <CourseEditor
            key="new"
            course={null}
            defaultOrder={nextOrder}
            onCreated={selectCourse}
            onCancel={() => setCreatingNew(false)}
          />
        ) : selected ? (
          <CourseEditor key={selected.id} course={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <Card className="gap-0 rounded-2xl p-0">
            <EmptyState
              icon={Clapperboard}
              title="El Estudio"
              description="Selecciona un programa de la lista para editarlo y gestionar sus lecciones, o crea uno nuevo con «Nuevo»."
            />
          </Card>
        )}
      </div>
    </div>
  )
}

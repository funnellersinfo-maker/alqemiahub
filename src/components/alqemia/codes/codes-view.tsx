"use client"

// ============================================================
// EL GRIMORIO — Repositorio de códigos del gremio (estilo GitHub)
// Los alquimistas guardan aquí el código de sus creaciones, como
// en un Drive: privado o público. El código público de otros se
// puede bifurcar (copiar) para reutilizarlo en el propio grimorio.
// ============================================================

import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Clipboard,
  Download,
  FilePlus2,
  FolderGit2,
  GitFork,
  Globe,
  Loader2,
  Lock,
  Pencil,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/alqemia/empty-state"
import { UserAvatar } from "@/components/alqemia/avatar"
import { AlqemiaLetters } from "@/components/alqemia/fx/alqemia-lettering"
import { timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import {
  CODE_LANGUAGES,
  codeLanguageLabel,
  type CodeDetailDTO,
  type CodeDTO,
  type CodeVisibility,
} from "@/lib/types"

// Color del punto por lenguaje (paleta de marcas, como en GitHub)
const LANG_DOTS: Record<string, string> = {
  javascript: "#f7df1e",
  typescript: "#3178c6",
  python: "#ffd43b",
  html: "#e34c26",
  css: "#9ca3f9",
  json: "#a1a1aa",
  sql: "#e38c3d",
  bash: "#89e051",
  php: "#8993be",
  java: "#b07219",
  csharp: "#178600",
  cpp: "#f34b7d",
  go: "#00add8",
  rust: "#dea584",
  swift: "#f05138",
  react: "#61dafb",
  markdown: "#c9a227",
  yaml: "#cb171e",
  texto: "#71717a",
}

function langDot(language: string): string {
  return LANG_DOTS[language] ?? "#71717a"
}

// ---------------- Insignia de visibilidad ----------------

function VisibilityBadge({ visibility }: { visibility: string }) {
  if (visibility === "PUBLIC") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright">
        <Globe className="h-3 w-3" aria-hidden /> Público
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
      <Lock className="h-3 w-3" aria-hidden /> Privado
    </span>
  )
}

// ---------------- Tarjeta de repositorio ----------------

function CodeCard({ code, onOpen }: { code: CodeDTO; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left focus-visible:outline-none"
      aria-label={`Ver ${code.title}`}
    >
      <Card className="gap-0 rounded-2xl border-zinc-800 bg-zinc-950 p-4 transition-all group-hover:border-gold/40 group-focus-visible:border-gold/40">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="min-w-0 truncate font-mono text-gold-bright">{code.fileName}</span>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: langDot(code.language) }}
            aria-hidden
          />
          <span className="shrink-0 text-zinc-500">{codeLanguageLabel(code.language)}</span>
        </div>

        <h3 className="mt-2.5 truncate font-semibold text-zinc-100">{code.title}</h3>
        <p
          className={cn(
            "mt-1 line-clamp-2 text-sm text-zinc-400",
            !code.description && "italic text-zinc-600"
          )}
        >
          {code.description || "Sin descripción"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VisibilityBadge visibility={code.visibility} />
          {code.forkedFromTitle && (
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-zinc-500">
              <GitFork className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">bifurcado de {code.forkedFromTitle}</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-zinc-900 pt-3">
          <UserAvatar user={code.owner} size="sm" />
          <span className="min-w-0 truncate text-xs text-zinc-400">{code.owner.name}</span>
          <span className="shrink-0 text-xs text-zinc-600">· {timeAgo(code.updatedAt)}</span>
          {code.forksCount > 0 && (
            <span
              className="ml-auto flex shrink-0 items-center gap-1 text-xs text-zinc-500"
              title="Bifurcaciones"
            >
              <GitFork className="h-3.5 w-3.5" aria-hidden /> {code.forksCount}
            </span>
          )}
        </div>
      </Card>
    </button>
  )
}

// ---------------- Formulario (crear / editar) ----------------

type CodeFormState = {
  title: string
  fileName: string
  language: string
  visibility: CodeVisibility
  description: string
  tags: string
  content: string
}

const EMPTY_FORM: CodeFormState = {
  title: "",
  fileName: "",
  language: "javascript",
  visibility: "PRIVATE",
  description: "",
  tags: "",
  content: "",
}

/**
 * El formulario en sí. Se monta fresco cada vez que se abre el
 * diálogo (la clave incluye el código editado), así que el estado
 * inicial se toma directamente de `editing` sin efectos.
 */
function CodeForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: CodeDetailDTO | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!editing
  const [form, setForm] = useState<CodeFormState>(() =>
    editing
      ? {
          title: editing.title,
          fileName: editing.fileName,
          language: editing.language,
          visibility: editing.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
          description: editing.description,
          tags: editing.tags ?? "",
          content: editing.content,
        }
      : { ...EMPTY_FORM }
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(isEdit ? `/api/codes/${editing.id}` : "/api/codes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          language: form.language,
          fileName: form.fileName.trim(),
          visibility: form.visibility,
          content: form.content,
          tags: form.tags,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo guardar el código")
      }
    },
    onSuccess: () => {
      toast.success("Código guardado en el grimorio")
      onSaved()
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function set<K extends keyof CodeFormState>(key: K, value: CodeFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const title = form.title.trim()
    if (title.length < 2 || title.length > 80) {
      toast.error("El título debe tener entre 2 y 80 caracteres")
      return
    }
    if (form.content.trim().length === 0) {
      toast.error("El código no puede estar vacío")
      return
    }
    saveMutation.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="code-title">Título *</Label>
          <Input
            id="code-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Embudo de venta para leads fríos"
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code-filename">Archivo</Label>
          <Input
            id="code-filename"
            value={form.fileName}
            onChange={(e) => set("fileName", e.target.value)}
            placeholder="script.js"
            maxLength={80}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="code-language">Lenguaje</Label>
          <Select value={form.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger id="code-language" className="w-full">
              <SelectValue placeholder="Lenguaje" />
            </SelectTrigger>
            <SelectContent className="max-h-72 border-zinc-800 bg-zinc-950">
              {CODE_LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code-tags">Etiquetas</Label>
          <Input
            id="code-tags"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="ecommerce, ads, python"
          />
          <p className="text-[11px] text-zinc-600">Separadas por comas, hasta 8.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Visibilidad</Label>
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Visibilidad del código"
        >
          <button
            type="button"
            role="radio"
            aria-checked={form.visibility === "PRIVATE"}
            onClick={() => set("visibility", "PRIVATE")}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
              form.visibility === "PRIVATE"
                ? "border-gold/50 bg-gold/10"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            )}
          >
            <Lock
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                form.visibility === "PRIVATE" ? "text-gold-bright" : "text-zinc-500"
              )}
              aria-hidden
            />
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  form.visibility === "PRIVATE" ? "text-gold-bright" : "text-zinc-200"
                )}
              >
                Privado
              </span>
              <span className="block text-xs text-zinc-500">Solo yo</span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={form.visibility === "PUBLIC"}
            onClick={() => set("visibility", "PUBLIC")}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
              form.visibility === "PUBLIC"
                ? "border-gold/50 bg-gold/10"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            )}
          >
            <Globe
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                form.visibility === "PUBLIC" ? "text-gold-bright" : "text-zinc-500"
              )}
              aria-hidden
            />
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  form.visibility === "PUBLIC" ? "text-gold-bright" : "text-zinc-200"
                )}
              >
                Público
              </span>
              <span className="block text-xs text-zinc-500">
                Todo el gremio puede verlo y bifurcarlo
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code-description">Descripción</Label>
        <Textarea
          id="code-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Qué hace, cómo se usa y qué problema resuelve…"
          maxLength={500}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code-content">Código *</Label>
        <Textarea
          id="code-content"
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="// Pega aquí el código de tu creación…"
          className="min-h-[240px] font-mono text-[13px]"
          spellCheck={false}
          required
        />
      </div>

      <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="border-zinc-800"
          onClick={onClose}
          disabled={saveMutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="btn-gold font-semibold" disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {isEdit ? "Guardar cambios" : "Guardar código"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function CodeFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: CodeDetailDTO | null
  onSaved: () => void
}) {
  const isEdit = !!editing
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg text-zinc-100">
            {isEdit ? "Editar código" : "Nuevo código"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos o el contenido de este código de tu grimorio."
              : "Guarda el código de tu creación: privado solo para ti, o público para el gremio."}
          </DialogDescription>
        </DialogHeader>
        <CodeForm
          key={editing?.id ?? "nuevo"}
          editing={editing}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Detalle del código ----------------

function CodeDetailView({
  id,
  onBack,
  onForked,
  onDeleted,
  onEdit,
}: {
  id: string
  onBack: () => void
  onForked: () => void
  onDeleted: () => void
  onEdit: (code: CodeDetailDTO) => void
}) {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data, isLoading, error } = useQuery<{ code: CodeDetailDTO }>({
    queryKey: ["codes", id],
    queryFn: async () => {
      const res = await fetch(`/api/codes/${id}`)
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo cargar el código")
      }
      return res.json()
    },
  })

  const forkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/codes/${id}/fork`, { method: "POST" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo bifurcar el código")
      }
    },
    onSuccess: () => {
      toast.success("Código bifurcado a tu grimorio")
      void queryClient.invalidateQueries({ queryKey: ["codes"] })
      onForked()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/codes/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo eliminar el código")
      }
    },
    onSuccess: () => {
      toast.success("Código eliminado del grimorio")
      void queryClient.invalidateQueries({ queryKey: ["codes"] })
      onDeleted()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="text-zinc-400" onClick={onBack}>
          <ArrowLeft aria-hidden /> Volver al grimorio
        </Button>
        <Skeleton className="mt-6 h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <Skeleton className="mt-6 h-72 rounded-xl" />
      </div>
    )
  }

  const code = data?.code
  if (!code) {
    return (
      <Card className="gap-0 rounded-2xl p-0">
        <EmptyState
          icon={FolderGit2}
          title="No se pudo cargar el código"
          description={error?.message ?? "Puede que sea privado o ya no exista."}
          action={
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft aria-hidden /> Volver al grimorio
            </Button>
          }
        />
      </Card>
    )
  }

  const lines = code.content.split("\n")

  const copyContent = () => {
    navigator.clipboard
      .writeText(code.content)
      .then(() => toast.success("Código copiado"))
      .catch(() => toast.error("No se pudo copiar el código"))
  }

  const download = () => {
    const blob = new Blob([code.content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = code.fileName || "codigo.txt"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Descargado")
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="text-zinc-400" onClick={onBack}>
        <ArrowLeft aria-hidden /> Volver al grimorio
      </Button>

      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-gold-bright">{code.fileName}</span>
          <VisibilityBadge visibility={code.visibility} />
        </div>
        <h2 className="mt-1.5 text-xl font-semibold text-zinc-100">{code.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <UserAvatar user={code.owner} size="sm" />
          <span className="font-medium text-zinc-300">{code.owner.name}</span>
          {code.owner.headline && (
            <span className="hidden min-w-0 truncate sm:inline">· {code.owner.headline}</span>
          )}
          <span>· actualizado {timeAgo(code.updatedAt)}</span>
          {code.forksCount > 0 && (
            <span className="flex shrink-0 items-center gap-1" title="Bifurcaciones">
              · <GitFork className="h-3 w-3" aria-hidden /> {code.forksCount}
            </span>
          )}
        </div>
        {code.forkedFromTitle && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500">
            <GitFork className="h-3 w-3 shrink-0" aria-hidden />
            bifurcado de «{code.forkedFromTitle}»
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="border-zinc-800" onClick={copyContent}>
          <Clipboard aria-hidden /> Copiar
        </Button>
        <Button variant="outline" size="sm" className="border-zinc-800" onClick={download}>
          <Download aria-hidden /> Descargar
        </Button>
        {!code.isMine && (
          <Button
            size="sm"
            className="btn-gold font-semibold"
            disabled={forkMutation.isPending}
            onClick={() => forkMutation.mutate()}
          >
            {forkMutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <GitFork aria-hidden />
            )}
            Usar este código
          </Button>
        )}
        {code.isMine && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-800"
              onClick={() => onEdit(code)}
            >
              <Pencil aria-hidden /> Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-800 text-red-400 hover:bg-red-950/40 hover:text-red-300"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden /> Eliminar
            </Button>
          </>
        )}
      </div>

      {/* Visor de código con numeración de líneas */}
      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: langDot(code.language) }}
            aria-hidden
          />
          <span className="min-w-0 truncate font-mono text-xs text-gold-bright">
            {code.fileName}
          </span>
          <span className="shrink-0 text-xs text-zinc-500">{codeLanguageLabel(code.language)}</span>
          <span className="ml-auto shrink-0 text-[11px] text-zinc-600">{lines.length} líneas</span>
        </div>
        <div className="max-h-[65vh] overflow-auto">
          <pre className="font-mono text-[13px] leading-relaxed">
            <code className="block min-w-max py-3">
              {lines.map((line, i) => (
                <span key={i} className="flex">
                  <span className="sticky left-0 z-10 w-10 shrink-0 select-none bg-zinc-900 pr-3 text-right text-zinc-600">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre pr-8 text-zinc-300">
                    {line.length > 0 ? line : " "}
                  </span>
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>

      {code.description && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Descripción
          </h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
            {code.description}
          </p>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar código?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{code.title}» de tu grimorio. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 font-semibold text-white hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate()
              }}
            >
              {deleteMutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------- Vista principal ----------------

export function CodesView() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState("mios")
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CodeDetailDTO | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery<{ codes: CodeDTO[] }>({
    queryKey: ["codes"],
    queryFn: async () => {
      const res = await fetch("/api/codes")
      if (!res.ok) throw new Error("No se pudo cargar el grimorio")
      return res.json()
    },
  })

  // Al abrir un código en detalle, volver arriba para leerlo desde el inicio
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [selectedId])

  const codes = data?.codes ?? []
  const visible = tab === "mios" ? codes.filter((c) => c.isMine) : codes.filter((c) => !c.isMine)

  return (
    <div className="mx-auto w-full max-w-5xl">
      {selectedId ? (
        <CodeDetailView
          id={selectedId}
          onBack={() => setSelectedId(null)}
          onForked={() => {
            setSelectedId(null)
            setTab("mios")
          }}
          onDeleted={() => setSelectedId(null)}
          onEdit={(code) => setEditing(code)}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl">
                <AlqemiaLetters text="El Grimorio" strokeWidth={8} />
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                El código de tus creaciones: guárdalo, compártelo y bifurca el de otros alquimistas.
              </p>
            </div>
            <Button
              type="button"
              className="btn-gold shrink-0 font-semibold"
              onClick={() => setCreateOpen(true)}
            >
              <FilePlus2 aria-hidden />
              Nuevo código
            </Button>
          </header>

          <Tabs value={tab} onValueChange={setTab} className="mt-4">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="mios">Mis códigos</TabsTrigger>
              <TabsTrigger value="explorar">Explorar</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-52 rounded-2xl" />
                  ))}
                </div>
              ) : error ? (
                <Card className="gap-0 rounded-2xl p-0">
                  <EmptyState
                    icon={FolderGit2}
                    title="No se pudo cargar el grimorio"
                    description={error.message}
                    action={
                      <Button variant="outline" size="sm" onClick={() => void refetch()}>
                        Reintentar
                      </Button>
                    }
                  />
                </Card>
              ) : visible.length === 0 ? (
                <Card className="gap-0 rounded-2xl p-0">
                  {tab === "mios" ? (
                    <EmptyState
                      icon={FolderGit2}
                      title="Tu grimorio está vacío"
                      description="Guarda aquí el código de tus creaciones — scripts, plantillas, automatizaciones — y tenlo siempre a mano, privado o público."
                      action={
                        <Button className="btn-gold" size="sm" onClick={() => setCreateOpen(true)}>
                          <FilePlus2 aria-hidden /> Nuevo código
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={GitFork}
                      title="Nada público para explorar"
                      description="Cuando otros alquimistas publiquen códigos públicos, aparecerán aquí listos para que los bifurques a tu grimorio."
                    />
                  )}
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visible.map((code) => (
                    <CodeCard key={code.id} code={code} onOpen={() => setSelectedId(code.id)} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <CodeFormDialog
        open={createOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        editing={editing}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["codes"] })
          if (!editing) setTab("mios")
        }}
      />
    </div>
  )
}

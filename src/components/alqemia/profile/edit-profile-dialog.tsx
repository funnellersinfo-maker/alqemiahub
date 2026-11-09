"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { ApiErrorShape } from "@/lib/types"
import { useMe } from "@/hooks/use-me"
import { cn } from "@/lib/utils"
import { AVATAR_COLORS, UserAvatar } from "@/components/alqemia/avatar"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"

/** Recorta la imagen al centro (256x256) y la comprime a dataURL JPEG. */
function processImageFile(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("Formato de imagen no válido"))
      img.onload = () => {
        const size = 256
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Tu navegador no soporta esta operación"))
          return
        }
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
        let out = canvas.toDataURL("image/jpeg", 0.85)
        if (out.length > 240000) out = canvas.toDataURL("image/jpeg", 0.6)
        resolve(out)
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export function EditProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data } = useMe()
  const user = data?.user
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [headline, setHeadline] = useState("")
  const [bio, setBio] = useState("")
  const [goal, setGoal] = useState("")
  const [imageDataURL, setImageDataURL] = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState<string>(AVATAR_COLORS[0])
  const [saving, setSaving] = useState(false)

  // Valores iniciales cada vez que se abre el diálogo
  useEffect(() => {
    if (open && user) {
      setName(user.name)
      setHeadline(user.headline ?? "")
      setBio(user.bio ?? "")
      setGoal(user.goal ?? "")
      setImageDataURL(user.image)
      setAvatarColor(user.avatarColor ?? AVATAR_COLORS[0])
      setSaving(false)
    }
  }, [open, user])

  function selectColor(color: string) {
    setAvatarColor(color)
    // Elegir color implica usar el avatar de color (sin foto)
    setImageDataURL(null)
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const out = await processImageFile(file)
      setImageDataURL(out)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la imagen")
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || saving) return
    setSaving(true)
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        headline: headline.trim() || "",
        bio: bio.trim(),
        goal: goal.trim(),
      }
      // Solo incluimos "image" cuando es un dataURL válido (subida nueva).
      // Para quitar la foto simplemente no se envía "image" y viaja avatarColor.
      if (
        imageDataURL &&
        imageDataURL.startsWith("data:image/") &&
        imageDataURL !== user.image
      ) {
        body.image = imageDataURL
      }
      if (!imageDataURL) {
        body.avatarColor = avatarColor
      }

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as ApiErrorShape
        throw new Error(json.error ?? "No se pudo actualizar el perfil")
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      toast.success("Perfil actualizado")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el perfil")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>Así te ve la comunidad.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Selector de avatar */}
          <div className="flex flex-col items-center gap-3">
            <UserAvatar
              user={{ name: name || "A", image: imageDataURL, avatarColor }}
              size="xl"
            />
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_COLORS.map((color) => {
                const selected = !imageDataURL && avatarColor === color
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color de avatar ${color}`}
                    onClick={() => selectColor(color)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white transition",
                      selected
                        ? "ring-2 ring-gold-deep ring-offset-2"
                        : "ring-1 ring-zinc-200 hover:ring-zinc-400"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {(name.trim()[0] ?? "A").toUpperCase()}
                  </button>
                )
              })}
            </div>
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-zinc-700 p-2.5 text-xs font-medium text-zinc-400 transition hover:border-gold hover:text-gold">
              <Camera className="h-4 w-4" aria-hidden />
              Cambiar foto
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {imageDataURL ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => setImageDataURL(null)}
              >
                Quitar foto
              </Button>
            ) : null}
          </div>

          {/* Campos */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-headline">Titular</Label>
              <Input
                id="edit-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={240}
                placeholder="Ej: Ecommerce · Moda · Copywriting"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-goal">Objetivos</Label>
              <Input
                id="edit-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={240}
                placeholder="Ej: Lanzar mi tienda · Escalar ventas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-bio">Sobre mí</Label>
              <Textarea
                id="edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Guardando
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

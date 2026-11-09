"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function AdminGate() {
  const adminGateOpen = useAppStore((s) => s.adminGateOpen)
  const setAdminGateOpen = useAppStore((s) => s.setAdminGateOpen)
  const setAdminUnlocked = useAppStore((s) => s.setAdminUnlocked)
  const setView = useAppStore((s) => s.setView)

  const [key, setKey] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState(false)
  const [verifying, setVerifying] = useState(false)

  function handleOpenChange(open: boolean) {
    setAdminGateOpen(open)
    if (!open) setError(false)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed || verifying) return
    setVerifying(true)
    setError(false)
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmed }),
      })
      if (res.ok) {
        localStorage.setItem("alqemia-admin-key", trimmed)
        setAdminUnlocked(true)
        setView("admin")
        setAdminGateOpen(false)
        toast.success("Acceso concedido")
      } else if (res.status === 401) {
        setError(true)
      } else {
        toast.error("No se pudo verificar la clave")
      }
    } catch {
      toast.error("No se pudo verificar la clave")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Dialog open={adminGateOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm border-zinc-800 bg-zinc-950 text-white sm:max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gold-deep/10">
          <KeyRound className="h-6 w-6 text-gold" aria-hidden />
        </div>

        <DialogTitle className="text-center font-display">Panel de Administración</DialogTitle>
        <DialogDescription className="text-center text-zinc-400">
          Acceso exclusivo del equipo ALQEMIA. Ingresa tu clave de acceso.
        </DialogDescription>

        <form onSubmit={onSubmit} className="mt-4">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Clave de acceso"
              autoFocus
              aria-invalid={error}
              className={cn(
                "h-11 border-zinc-700 bg-zinc-900 pr-10 text-white placeholder:text-zinc-400",
                error && "border-red-500/50"
              )}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar clave" : "Mostrar clave"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 transition hover:text-zinc-300"
            >
              {show ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-red-400">
              Clave incorrecta. Verifica e intenta de nuevo.
            </p>
          ) : null}

          <Button type="submit" className="mt-4 h-11 w-full" disabled={verifying}>
            {verifying ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Verificando
              </>
            ) : (
              "Desbloquear panel"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

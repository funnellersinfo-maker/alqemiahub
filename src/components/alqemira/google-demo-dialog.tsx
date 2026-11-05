"use client"

import { useEffect, useState, type FormEvent } from "react"
import { signIn } from "next-auth/react"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ApiErrorShape } from "@/lib/types"

type DemoAccount = { name: string; email: string }

const STORAGE_KEY = "alqemira-demo-accounts"

const SEED_ACCOUNTS: DemoAccount[] = [
  { name: "Ana Martínez", email: "ana.demo@gmail.com" },
  { name: "Luis Gómez", email: "luis.demo@gmail.com" },
]

function isDemoAccount(value: unknown): value is DemoAccount {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.name === "string" && typeof v.email === "string"
}

/** Lee las cuentas demo guardadas; siembra las iniciales la primera vez. */
function readAccounts(): DemoAccount[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ACCOUNTS))
      return SEED_ACCOUNTS
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return SEED_ACCOUNTS
    const accounts = parsed.filter(isDemoAccount)
    return accounts.length > 0 ? accounts : SEED_ACCOUNTS
  } catch {
    return SEED_ACCOUNTS
  }
}

/** Guarda una cuenta nueva en localStorage (si aún no existe). */
function persistAccount(account: DemoAccount): void {
  try {
    const current = readAccounts()
    const exists = current.some((a) => a.email.toLowerCase() === account.email.toLowerCase())
    if (!exists) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, account]))
    }
  } catch {
    // Sin localStorage la demo sigue funcionando, solo no persiste.
  }
}

function initialOf(name: string): string {
  const ch = name.trim().charAt(0)
  return (ch || "A").toUpperCase()
}

// Logo oficial de Google (marca de terceros permitida)
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROW_CLASSES =
  "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:pointer-events-none disabled:opacity-60"

export function GoogleDemoDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [accounts, setAccounts] = useState<DemoAccount[]>([])
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null)
  const [showOther, setShowOther] = useState(false)
  const [otherName, setOtherName] = useState("")
  const [otherEmail, setOtherEmail] = useState("")

  useEffect(() => {
    if (open) {
      setAccounts(readAccounts())
      setShowOther(false)
      setOtherName("")
      setOtherEmail("")
    } else {
      setLoadingEmail(null)
    }
  }, [open])

  async function chooseAccount(account: DemoAccount) {
    if (loadingEmail) return
    setLoadingEmail(account.email)
    try {
      const res = await fetch("/api/auth/google-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as ApiErrorShape | null
        toast.error(errorData?.error ?? "No se pudo continuar con esa cuenta")
        return
      }
      persistAccount(account)
      const result = await signIn("credentials", {
        email: account.email,
        mode: "google-demo",
        redirect: false,
      })
      if (result?.error) {
        toast.error("No se pudo iniciar sesión con esa cuenta")
        return
      }
      onOpenChange(false)
    } catch {
      toast.error("No se pudo iniciar sesión con esa cuenta")
    } finally {
      setLoadingEmail(null)
    }
  }

  function handleOtherSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = otherName.trim()
    const email = otherEmail.trim().toLowerCase()
    if (name.length < 2) {
      toast.error("Ingresa tu nombre")
      return
    }
    if (!EMAIL_RE.test(email)) {
      toast.error("Ingresa un email válido")
      return
    }
    void chooseAccount({ name, email })
  }

  const busy = loadingEmail !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-sm">
        <div className="p-5 pb-3">
          <GoogleLogo className="h-6 w-6" />
          <DialogTitle className="mt-3 text-lg font-semibold text-zinc-900">
            Elige una cuenta
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            para continuar en ALQEMIRA
          </DialogDescription>
        </div>

        <div className="p-2">
          {accounts.map((account, index) => (
            <button
              key={account.email}
              type="button"
              autoFocus={index === 0 && !showOther}
              disabled={busy}
              onClick={() => void chooseAccount(account)}
              className={ROW_CLASSES}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                {initialOf(account.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {account.name}
                </span>
                <span className="block truncate text-xs text-zinc-500">{account.email}</span>
              </span>
              {loadingEmail === account.email && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-hidden="true" />
              )}
            </button>
          ))}

          {showOther ? (
            <form onSubmit={handleOtherSubmit} className="animate-view space-y-3 p-3">
              <div>
                <Label htmlFor="demo-other-name">Nombre</Label>
                <Input
                  id="demo-other-name"
                  autoFocus
                  className="mt-2"
                  autoComplete="name"
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="demo-other-email">Email</Label>
                <Input
                  id="demo-other-email"
                  type="email"
                  className="mt-2"
                  autoComplete="email"
                  value={otherEmail}
                  onChange={(e) => setOtherEmail(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setShowOther(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Continuar
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowOther(true)}
              className={ROW_CLASSES}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                <UserPlus className="h-4 w-4 text-zinc-700" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-zinc-900">Usar otra cuenta</span>
            </button>
          )}
        </div>

        <div className="border-t border-zinc-200 p-4 pt-2">
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Modo demo: configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env para activar el
            OAuth real de Google.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

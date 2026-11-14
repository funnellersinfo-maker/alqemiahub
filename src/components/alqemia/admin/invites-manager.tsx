"use client"

// ============================================================
// ADMIN — Códigos de Invitación
// El titular genera códigos únicos ingresando el correo con el
// que el prospecto se va a registrar. Correo y código deben
// coincidir al registrarse; un código funciona una sola vez.
// ============================================================

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  MailPlus,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import type { InviteDTO, InviteStatus } from "@/lib/types"
import { timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const key = localStorage.getItem("alqemia-admin-key") ?? ""
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "x-admin-key": key, ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? "Error inesperado")
  }
  return res.json() as Promise<T>
}

function StatusBadge({ status }: { status: InviteStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap",
        status === "PENDING" && "border-gold/40 bg-gold/10 text-gold-bright hover:bg-gold/10",
        status === "USED" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10",
        status === "EXPIRED" && "border-zinc-600 bg-zinc-700/20 text-zinc-400 hover:bg-zinc-700/20"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "PENDING" && "bg-gold",
          status === "USED" && "bg-emerald-500",
          status === "EXPIRED" && "bg-zinc-500"
        )}
        aria-hidden
      />
      {status === "PENDING" ? "Pendiente" : status === "USED" ? "Usado" : "Expirado"}
    </Badge>
  )
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 text-zinc-400 hover:text-gold-bright"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          toast.success(`Código copiado: ${code}`)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          toast.error("No se pudo copiar. Cópialo a mano.")
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  )
}

export function InvitesManager() {
  const queryClient = useQueryClient()

  // Formulario
  const [email, setEmail] = useState("")
  const [note, setNote] = useState("")
  const [lastCreated, setLastCreated] = useState<InviteDTO | null>(null)

  // Filtros
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"ALL" | InviteStatus>("ALL")

  const query = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => adminFetch<{ invites: InviteDTO[] }>("/api/admin/invites"),
  })
  const invites = query.data?.invites ?? []

  const createMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ invite: InviteDTO }>("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), note: note.trim() || undefined }),
      }),
    onSuccess: (data) => {
      setLastCreated(data.invite)
      setEmail("")
      setNote("")
      void queryClient.invalidateQueries({ queryKey: ["admin-invites"] })
      toast.success("Invitación forjada")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const regenerateMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch<{ invite: InviteDTO }>("/api/admin/invites", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      }),
    onSuccess: (data) => {
      if (lastCreated && lastCreated.id === data.invite.id) setLastCreated(data.invite)
      void queryClient.invalidateQueries({ queryKey: ["admin-invites"] })
      toast.success(`Nuevo código: ${data.invite.code}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string; code: string }) =>
      adminFetch<{ ok: boolean }>("/api/admin/invites", {
        method: "DELETE",
        body: JSON.stringify({ id: vars.id }),
      }),
    onSuccess: (_d, vars) => {
      if (lastCreated?.id === vars.id) setLastCreated(null)
      void queryClient.invalidateQueries({ queryKey: ["admin-invites"] })
      toast.success(`Invitación ${vars.code} eliminada`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return invites.filter(
      (i) =>
        (filter === "ALL" || i.status === filter) &&
        (!term || i.email.toLowerCase().includes(term) || i.code.toLowerCase().includes(term))
    )
  }, [invites, q, filter])

  const pendingCount = invites.filter((i) => i.status === "PENDING").length
  const usedCount = invites.filter((i) => i.status === "USED").length

  return (
    <div className="space-y-3">
      {/* ============ CÓMO FUNCIONA + FORMULARIO ============ */}
      <Card className="gap-0 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950">
            <Ticket className="h-5 w-5 text-gold" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-100">Forjar una invitación</h3>
            <p className="text-xs text-zinc-500">
              Ingresa el correo del prospecto: solo con ese correo y su código podrá registrarse.
            </p>
          </div>
        </div>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            if (!email.trim()) {
              toast.error("Ingresa el correo del prospecto")
              return
            }
            createMutation.mutate()
          }}
        >
          <div>
            <Label htmlFor="invite-email">Correo del prospecto</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="prospecto@email.com"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invite-note">
              Nota interna <span className="text-zinc-600">(opcional)</span>
            </Label>
            <Input
              id="invite-note"
              placeholder="Ej. Juan · master de Meta Ads"
              className="mt-1.5"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="btn-gold h-10 w-full font-semibold sm:w-auto"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <MailPlus aria-hidden />
              )}
              Generar código
            </Button>
          </div>
        </form>

        {/* Último código generado: protagonista */}
        {lastCreated && (
          <div className="animate-chip-pop mt-4 rounded-xl border border-gold/30 bg-gold/[0.06] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gold/80">
                  Invitación lista para {lastCreated.email}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.15em] text-gold-bright">
                  {lastCreated.code}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Envíalo por WhatsApp o email: debe registrarse con este mismo correo.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CopyCodeButton code={lastCreated.code} />
                {lastCreated.status === "PENDING" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-zinc-700 text-zinc-300 hover:border-gold/40 hover:text-gold-bright"
                    disabled={regenerateMutation.isPending}
                    onClick={() => regenerateMutation.mutate(lastCreated.id)}
                  >
                    <RefreshCw aria-hidden />
                    Regenerar
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ============ LISTA ============ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por correo o código..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(
            [
              { value: "ALL", label: `Todas · ${invites.length}` },
              { value: "PENDING", label: `Pendientes · ${pendingCount}` },
              { value: "USED", label: `Usadas · ${usedCount}` },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.value
                  ? "border-gold-deep bg-gold/10 text-gold-bright"
                  : "border-zinc-800 text-zinc-400 hover:border-gold/30 hover:text-zinc-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.error ? (
        <Card className="gap-0 rounded-2xl p-5">
          <p className="text-sm text-zinc-400">{(query.error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="gap-0 rounded-2xl p-8 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-zinc-600" aria-hidden />
          <p className="mt-3 text-sm font-medium text-zinc-300">
            {invites.length === 0 ? "Aún no hay invitaciones" : "Sin resultados"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {invites.length === 0
              ? "Genera la primera con el correo de tu próximo miembro."
              : "Prueba con otro filtro o búsqueda."}
          </p>
        </Card>
      ) : (
        <>
          {/* Tabla escritorio */}
          <Card className="hidden gap-0 overflow-hidden rounded-2xl p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Prospecto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead>Usada</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <p className="max-w-[260px] truncate text-sm font-medium text-zinc-100">{i.email}</p>
                      {i.note ? (
                        <p className="max-w-[260px] truncate text-xs text-zinc-500">{i.note}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold tracking-widest text-gold-bright">
                        {i.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={i.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-zinc-500">
                      {timeAgo(i.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-zinc-500">
                      {i.usedAt ? timeAgo(i.usedAt) : "—"}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <CopyCodeButton code={i.code} />
                        {i.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Regenerar código de ${i.email}`}
                            title="Regenerar código"
                            className="h-8 w-8 text-zinc-400 hover:text-gold-bright"
                            disabled={regenerateMutation.isPending}
                            onClick={() => regenerateMutation.mutate(i.id)}
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar invitación de ${i.email}`}
                          title="Eliminar invitación"
                          className="h-8 w-8 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate({ id: i.id, code: i.code })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Tarjetas móvil */}
          <div className="space-y-3 md:hidden">
            {filtered.map((i) => (
              <Card key={i.id} className="gap-0 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{i.email}</p>
                    {i.note ? <p className="truncate text-xs text-zinc-500">{i.note}</p> : null}
                  </div>
                  <StatusBadge status={i.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <span className="font-mono text-sm font-bold tracking-widest text-gold-bright">{i.code}</span>
                  <CopyCodeButton code={i.code} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Creada {timeAgo(i.createdAt)}</span>
                  {i.usedAt ? <span>Usada {timeAgo(i.usedAt)}</span> : null}
                  <span className="flex items-center gap-1">
                    {i.status === "PENDING" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Regenerar código"
                        className="h-7 w-7 text-zinc-400 hover:text-gold-bright"
                        disabled={regenerateMutation.isPending}
                        onClick={() => regenerateMutation.mutate(i.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar invitación"
                      className="h-7 w-7 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate({ id: i.id, code: i.code })}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

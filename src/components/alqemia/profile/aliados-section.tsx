"use client"

// ============================================================
// PERFIL → MIS ALIADOS — Métricas del negocio del miembro
// · Como aliado: qué comisiones gané revendiendo
// · Como creador: quién revende mis productos, cuánto venden
//   y cuánto ganan (con confirmación de ventas pendientes)
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgeDollarSign, Check, Handshake, Loader2, Receipt, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { UserAvatar } from "@/components/alqemia/avatar"
import { cn } from "@/lib/utils"
import { productCategoryLabel, type AllyMetrics } from "@/lib/types"

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gold-bright tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
    </div>
  )
}

function PendingSaleRow({
  sale,
  onConfirm,
  busy,
}: {
  sale: AllyMetrics["asCreator"]["products"][number]["pendingSales"][number]
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/25 bg-gold/5 p-2.5">
      {sale.proofImage && (
        <a href={sale.proofImage} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img
            src={sale.proofImage}
            alt={`Comprobante de ${sale.buyerName}`}
            className="h-10 w-10 rounded-lg border border-zinc-800 object-cover"
          />
        </a>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-200">
          {sale.buyerName} · <span className="text-gold-bright">{sale.amount} {sale.currency}</span>
        </p>
        <p className="truncate text-[11px] text-zinc-500">
          Vendió <span className="text-zinc-300">{sale.reseller.name}</span> · comisión {sale.commission}{" "}
          {sale.currency} · {format(new Date(sale.createdAt), "d MMM · h:mm a", { locale: es })}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="btn-gold h-8 shrink-0 px-3 text-xs font-semibold"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
        Confirmar
      </Button>
    </div>
  )
}

export function AliadosSection() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<AllyMetrics>({
    queryKey: ["aliados-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/aliados")
      if (!res.ok) throw new Error("No se pudieron cargar tus métricas")
      return res.json()
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const res = await fetch(`/api/marketplace/sale/${saleId}`, { method: "PATCH" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo confirmar")
      }
    },
    onSuccess: () => {
      toast.success("Venta confirmada: la comisión queda acreditada al aliado")
      void queryClient.invalidateQueries({ queryKey: ["aliados-metrics"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !data) {
    return (
      <Card className="gap-0 rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-gold-bright" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-zinc-100">Mis Aliados</h2>
        </div>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </Card>
    )
  }

  const { asAlly, asCreator } = data
  const hasNothing = asAlly.totalSales === 0 && asCreator.totalProducts === 0

  return (
    <Card className="gate-card gap-0 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-gold-bright" aria-hidden />
        <h2 className="font-display text-lg font-semibold text-zinc-100">Mis Aliados</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Tu negocio en el Marketplace: comisiones como aliado y tu red de revendedores.
      </p>

      {hasNothing ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center text-sm text-zinc-500">
          Aún no hay actividad. Explora el Marketplace, agrega productos a tus{" "}
          <strong className="text-zinc-300">Aliados</strong> y revéndelos ganando comisión — o publica tu
          propio producto y deja que el gremio lo venda por ti.
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {/* ----- Como ALIADO ----- */}
          {asAlly.totalSales > 0 && (
            <section aria-label="Mis ventas como aliado">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gold-bright">
                Revendiendo como aliado
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatBox label="Ventas" value={String(asAlly.totalSales)} sub={`${asAlly.confirmedSales} confirmadas`} />
                <StatBox label="Pendientes" value={String(asAlly.pendingSales)} sub="por confirmar" />
                <StatBox
                  label="Comisiones"
                  value={String(asAlly.commissionEarned)}
                  sub="confirmadas"
                />
                <StatBox label="Tasa de cierre" value={`${asAlly.totalSales > 0 ? "100%" : "0%"}`} sub="de tus registros" />
              </div>

              {asAlly.recentSales.length > 0 && (
                <div className="mt-3 space-y-2">
                  {asAlly.recentSales.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
                        <Receipt className="h-4 w-4 text-zinc-400" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-200">
                          {s.productTitle} → {s.buyerName}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {format(new Date(s.createdAt), "d MMM · h:mm a", { locale: es })} · +{s.commission}{" "}
                          {s.currency} de comisión
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          s.status === "CONFIRMED"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-amber-500/15 text-amber-400"
                        )}
                      >
                        {s.status === "CONFIRMED" ? "Confirmada" : "Pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ----- Como CREADOR ----- */}
          {asCreator.totalProducts > 0 && (
            <section aria-label="Mi red de aliados">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold-bright" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gold-bright">
                  Mis productos y su red de aliados
                </h3>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatBox label="Productos" value={String(asCreator.totalProducts)} />
                <StatBox label="Ventas" value={String(asCreator.totalSales)} />
                <StatBox label="Ingresos" value={String(asCreator.revenue)} sub="confirmados" />
                <StatBox label="A aliados" value={String(asCreator.paidToAllies)} sub="comisiones pagadas" />
              </div>

              <div className="mt-3 space-y-4">
                {asCreator.products.map((p) => (
                  <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeDollarSign className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{p.title}</p>
                      <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                        {productCategoryLabel(p.category)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                      <span>
                        {p.views} vistas · <strong className="text-zinc-300">{p.salesCount} ventas</strong> ·
                        conversión {p.conversionPct}%
                      </span>
                      <span>
                        Precio {p.price} {p.currency}
                      </span>
                    </div>

                    {p.allies.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                          Aliados revendiendo ({p.allies.length})
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                          {p.allies.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-2.5 py-1.5"
                            >
                              <UserAvatar user={a} size="xs" />
                              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{a.name}</span>
                              <span className="shrink-0 text-[11px] text-zinc-500">
                                {a.salesCount} ventas ·{" "}
                                <strong className="text-gold-bright">{a.commission}</strong> ganado
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.pendingSales.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400">
                          Ventas por confirmar ({p.pendingSales.length})
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                          {p.pendingSales.map((s) => (
                            <PendingSaleRow
                              key={s.id}
                              sale={s}
                              busy={confirmMutation.isPending && confirmMutation.variables === s.id}
                              onConfirm={() => confirmMutation.mutate(s.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Card>
  )
}

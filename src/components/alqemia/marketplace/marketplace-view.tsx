"use client"

// ============================================================
// MARKETPLACE — Mercado interno del gremio
// Explorar por categorías · Agregar a Mis Aliados (revender
// con comisión) · Publicar productos · Registrar ventas con
// comprobante · Métricas del negocio en el perfil.
// ============================================================

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BadgeDollarSign,
  Handshake,
  ImageOff,
  Loader2,
  Package,
  PackagePlus,
  Repeat,
  Star,
  Store,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/alqemia/empty-state"
import { UserAvatar } from "@/components/alqemia/avatar"
import { PublishDialog } from "@/components/alqemia/marketplace/publish-dialog"
import { SaleDialog } from "@/components/alqemia/marketplace/sale-dialog"
import { useMe } from "@/hooks/use-me"
import { cn } from "@/lib/utils"
import {
  PRODUCT_CATEGORIES,
  productCategoryLabel,
  type ProductCategory,
  type ProductDTO,
} from "@/lib/types"

function priceLabel(p: { price: number; currency: string; recurring: boolean }): string {
  const value = p.price === Math.round(p.price) ? String(p.price) : p.price.toFixed(2)
  return `${p.currency} ${value}${p.recurring ? "/mes" : ""}`
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  if (category === "MICRO_APP") return <Package className={className} aria-hidden />
  if (category === "SERVICE") return <Handshake className={className} aria-hidden />
  if (category === "PHYSICAL") return <Store className={className} aria-hidden />
  return <BadgeDollarSign className={className} aria-hidden />
}

// ---------------- Tarjeta de producto ----------------

function ProductCard({ product, onOpen }: { product: ProductDTO; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 text-left transition-all hover:border-gold/40 hover:shadow-[0_0_28px_-10px_rgba(212,175,55,0.4)]"
      aria-label={`Ver ${product.title}`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
        {product.coverImage ? (
          <img
            src={product.coverImage}
            alt={`Portada de ${product.title}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-600">
            <CategoryIcon category={product.category} className="h-8 w-8" />
            <span className="text-[11px] font-medium uppercase tracking-wide">
              {productCategoryLabel(product.category)}
            </span>
          </div>
        )}
        {product.recurring && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright backdrop-blur">
            <Repeat className="h-3 w-3" aria-hidden /> Recurrente
          </span>
        )}
        {product.isAlly && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright backdrop-blur">
            <Star className="h-3 w-3 fill-gold-bright text-gold-bright" aria-hidden /> Mi aliado
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{product.title}</p>
          <p className="shrink-0 text-sm font-bold text-gold-bright">{priceLabel(product)}</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
            <UserAvatar user={product.seller} size="xs" />
            <span className="truncate">{product.seller.name}</span>
          </span>
          <span className="shrink-0 rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
            {product.commissionPct}% a aliados
          </span>
        </div>
      </div>
    </button>
  )
}

// ---------------- Detalle del producto ----------------

function ProductDetail({
  product,
  onClose,
}: {
  product: ProductDTO
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const isAdmin = me?.user.role === "ADMIN"

  const [saleOpen, setSaleOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const favMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/marketplace/${product.id}/favorite`, { method: "POST" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo actualizar")
      }
      return res.json() as Promise<{ isAlly: boolean }>
    },
    onSuccess: (data) => {
      toast.success(data.isAlly ? "Agregado a tus Aliados: ya puedes revenderlo" : "Quitado de tus Aliados")
      void queryClient.invalidateQueries({ queryKey: ["marketplace"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/marketplace/${product.id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "No se pudo eliminar")
      }
    },
    onSuccess: () => {
      toast.success("Producto eliminado")
      void queryClient.invalidateQueries({ queryKey: ["marketplace"] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["marketplace"] })
    void queryClient.invalidateQueries({ queryKey: ["aliados-metrics"] })
  }

  return (
    <>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg text-zinc-100">{product.title}</DialogTitle>
          <DialogDescription>
            {productCategoryLabel(product.category)} · Publicado el{" "}
            {format(new Date(product.createdAt), "d 'de' MMMM yyyy", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        {product.coverImage && (
          <img
            src={product.coverImage}
            alt={`Portada de ${product.title}`}
            className="aspect-video w-full rounded-xl border border-zinc-800 object-cover"
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold text-gold-bright">{priceLabel(product)}</span>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-bright">
            {product.commissionPct}% de comisión para aliados
          </span>
          {product.recurring && (
            <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
              Pago recurrente mensual
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <UserAvatar user={product.seller} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-200">{product.seller.name}</p>
            <p className="truncate text-xs text-zinc-500">{product.seller.headline ?? "Creador del gremio"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1" title="Vistas">
              <Users className="h-3.5 w-3.5" aria-hidden /> {product.views}
            </span>
            <span className="flex items-center gap-1" title="Aliados revendiendo">
              <Handshake className="h-3.5 w-3.5" aria-hidden /> {product.alliesCount}
            </span>
          </div>
        </div>

        {product.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{product.description}</p>
        )}

        {(product.isMine || product.isAlly) && product.contentUrl && (
          <div className="rounded-xl border border-gold/25 bg-gold/5 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-bright">Material del producto</p>
            <a
              href={product.contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-sm text-zinc-300 underline decoration-gold/50 underline-offset-2 hover:text-gold-bright"
            >
              {product.contentUrl}
            </a>
          </div>
        )}

        <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {(product.isMine || product.isAlly) && (
              <Button
                type="button"
                className="btn-gold font-semibold"
                onClick={() => setSaleOpen(true)}
              >
                <BadgeDollarSign aria-hidden />
                {product.isMine ? "Registrar venta directa" : "Registrar venta como aliado"}
              </Button>
            )}
            {(product.isMine || isAdmin) && (
              <Button
                type="button"
                variant="outline"
                className="border-zinc-800 text-red-400 hover:bg-red-950/40 hover:text-red-300"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
          {!product.isMine && (
            <Button
              type="button"
              variant={product.isAlly ? "outline" : "default"}
              className={cn(
                product.isAlly
                  ? "border-zinc-800"
                  : "btn-gold font-semibold"
              )}
              disabled={favMutation.isPending}
              onClick={() => favMutation.mutate()}
            >
              {favMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Star className={cn(product.isAlly && "fill-gold-bright text-gold-bright")} aria-hidden />
              )}
              {product.isAlly ? "Quitar de mis Aliados" : "Agregar a mis Aliados"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <SaleDialog product={product} open={saleOpen} onOpenChange={setSaleOpen} onDone={refresh} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">¿Eliminar producto?</DialogTitle>
            <DialogDescription>
              Se eliminará «{product.title}» junto con su registro de ventas. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-800" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 font-semibold text-white hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------- Vista principal ----------------

export function MarketplaceView() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState("explorar")
  const [category, setCategory] = useState<string>("")
  const [publishOpen, setPublishOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ products: ProductDTO[] }>({
    queryKey: ["marketplace", category],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace${category ? `?category=${category}` : ""}`)
      if (!res.ok) throw new Error("No se pudo cargar el Marketplace")
      return res.json()
    },
  })

  // Un solo listado: las pestañas filtran en el cliente (isAlly / isMine)
  const products = data?.products ?? []
  const filtered =
    tab === "aliados" ? products.filter((p) => p.isAlly) : tab === "mios" ? products.filter((p) => p.isMine) : products

  const mine = tab === "mios"
  const detail = selectedId ? products.find((p) => p.id === selectedId) : null

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-sm text-zinc-500">
            El mercado del gremio: crea, revende productos de otros miembros y gana comisiones.
          </p>
        </div>
        <Button type="button" className="btn-gold shrink-0 font-semibold" onClick={() => setPublishOpen(true)}>
          <PackagePlus aria-hidden />
          Publicar
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="explorar">Explorar</TabsTrigger>
          <TabsTrigger value="aliados">Mis Aliados</TabsTrigger>
          <TabsTrigger value="mios">Mis Publicaciones</TabsTrigger>
        </TabsList>

        {/* Filtros de categoría (solo en explorar) */}
        {tab === "explorar" && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
            <button
              type="button"
              onClick={() => setCategory("")}
              aria-pressed={category === ""}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                category === ""
                  ? "border-gold-deep bg-gold/10 text-gold-bright"
                  : "border-zinc-800 text-zinc-400 hover:border-gold/40 hover:text-zinc-200"
              )}
            >
              Todas
            </button>
            {PRODUCT_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                aria-pressed={category === c.value}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                  category === c.value
                    ? "border-gold-deep bg-gold/10 text-gold-bright"
                    : "border-zinc-800 text-zinc-400 hover:border-gold/40 hover:text-zinc-200"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="aspect-video rounded-2xl" />
              <Skeleton className="aspect-video rounded-2xl" />
              <Skeleton className="aspect-video rounded-2xl" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="gap-0 rounded-2xl p-0">
              <EmptyState
                icon={tab === "aliados" ? Handshake : tab === "mios" ? Package : ImageOff}
                title={
                  tab === "aliados"
                    ? "Aún no tienes aliados"
                    : tab === "mios"
                      ? "Todavía no has publicado"
                      : "No hay productos en esta categoría"
                }
                description={
                  tab === "aliados"
                    ? "Explora el mercado y agrega productos a tus Aliados para revenderlos con comisión."
                    : tab === "mios"
                      ? "Publica tu primer producto: micro app, infoproducto, producto físico o servicio."
                      : "Prueba otra categoría o vuelve más tarde."
                }
                action={
                  tab === "mios" ? (
                    <Button className="btn-gold" size="sm" onClick={() => setPublishOpen(true)}>
                      <PackagePlus aria-hidden /> Publicar producto
                    </Button>
                  ) : tab === "aliados" ? (
                    <Button variant="outline" size="sm" onClick={() => setTab("explorar")}>
                      Explorar mercado
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onOpen={() => setSelectedId(p.id)} />
              ))}
            </div>
          )}
          {mine && filtered.length > 0 && (
            <p className="mt-4 text-center text-xs text-zinc-500">
              Las métricas de tus productos (ventas, aliados, conversión) están en tu Perfil → Mis Aliados.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: ["marketplace"] })
          setTab("mios")
        }}
      />

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setSelectedId(null)}>
        {detail && <ProductDetail product={detail} onClose={() => setSelectedId(null)} />}
      </Dialog>
    </div>
  )
}

"use client"

// ============================================================
// ALQEMIA — FitText · Regla general anti-desborde
// ------------------------------------------------------------
// Problema: en móviles, textos dentro de contenedores de tamaño
// fijo o limitado (tarjetas de logros, chips, cajas de stats) se
// DESBORDAN (overflow horizontal o vertical) porque el tamaño de
// fuente no cabe en su contenedor.
//
// Regla general: este componente auto-ajusta el font-size EN
// TIEMPO REAL para que el texto SIEMPRE quepa en su contenedor,
// en cualquier dispositivo, sin configurarlo caso por caso.
//
// Cómo lo consigue:
//  · Bucle iterativo por refs: reduce el font-size en pasos de
//    0.5px hasta que el texto quepa (sin setState → cero
//    re-renders, todo por style directo).
//  · ResizeObserver sobre el propio contenedor: re-ajusta en
//    rotación, resize de ventana o cambios de layout.
//  · Re-lectura del font-size heredado en cada ajuste (limpiando
//    antes el inline y forzando reflow), por lo que también
//    re-escala hacia ARRIBA cuando vuelve a haber espacio.
//
// Nota de uso: para que el límite VERTICAL se detecte, el
// elemento debe tener altura acotada (p. ej. className="h-full"
// dentro de una caja de altura fija). El límite horizontal se
// detecta siempre (los elementos block ocupan el ancho del padre).
// ============================================================

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ElementType,
} from "react"

import { cn } from "@/lib/utils"

// useLayoutEffect isomórfico (defensivo ante SSR: en servidor cae
// a useEffect para evitar el warning clásico de React).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

/** Paso de reducción de font-size por iteración (px). */
const STEP_PX = 0.5
/** Máximo de iteraciones del bucle de ajuste (red de seguridad). */
const MAX_ITERATIONS = 200
/** Tolerancia (px) al comparar scroll* vs client* (ignora sub-píxeles). */
const TOLERANCE = 1
/** Frames de reintento cuando el contenedor aún no tiene ancho. */
const RETRY_FRAMES = 120
/** Fallback si nunca se pudo leer un font-size computado válido. */
const FALLBACK_SIZE = 16

export type FitTextProps = {
  /** Texto plano a renderizar (sin children arbitrarios) */
  children: string
  /** Tamaño mínimo de fuente en px (default 8.5) */
  min?: number
  /** Tamaño máximo de fuente en px (default: se lee del computed style del padre) */
  max?: number
  /** Clases para el elemento contenedor (por defecto "block") */
  className?: string
  /** Etiqueta del contenedor (default "span"). Se usa p.ej. "p", "h3", "div" */
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "label" | "li"
  /** Número de líneas máximas visibles: si se pasa, se recorta con line-clamp (default: sin límite) */
  lines?: number
  /** Para desactivar temporalmente (default false) */
  disabled?: boolean
}

export function FitText({
  children,
  min = 8.5,
  max,
  className,
  as = "span",
  lines,
  disabled = false,
}: FitTextProps) {
  const containerRef = useRef<HTMLElement | null>(null)
  // Último font-size "heredado" (sin nuestro inline) leído del computed
  // style. Se refresca en cada ajuste y sirve de fallback de lectura.
  const inheritedSizeRef = useRef<number | null>(null)

  useIsoLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    let raf: number | null = null
    let disposed = false
    let retries = RETRY_FRAMES

    const cancelFrame = () => {
      if (raf != null) {
        cancelAnimationFrame(raf)
        raf = null
      }
    }

    /**
     * AJUSTE (regla general anti-desborde):
     *  1. Se limpia NUESTRO fontSize inline y se fuerza reflow para leer
     *     el font-size heredado real (clases propias + cascada), sin
     *     contaminarlo con el ajuste de la pasada anterior.
     *  2. Se parte de `max` (si viene) o del heredado leído.
     *  3. Bucle: mientras haya overflow (scrollHeight > clientHeight + 1
     *     o scrollWidth > clientWidth + 1) y size > min, se reduce 0.5px
     *     y se re-mide. Máximo 200 iteraciones de seguridad.
     * Si al llegar a `min` todavía no cabe, el line-clamp (si hay
     * `lines`) se encarga del recorte visual.
     */
    const runFit = () => {
      raf = null
      if (disposed) return
      if (disabled) {
        // Desactivado: no tocar nada, fontSize natural (heredado).
        el.style.fontSize = ""
        return
      }
      // El contenedor aún no tiene ancho (layout pendiente o display:
      // none): reintentar en el próximo frame (acotado; el
      // ResizeObserver cubre el caso de que gane tamaño más tarde).
      if (el.clientWidth <= 0) {
        if (retries > 0) {
          retries -= 1
          raf = requestAnimationFrame(runFit)
        }
        return
      }

      // (1) Leer el tamaño heredado sin contaminarlo con nuestro inline:
      // limpiar nuestro fontSize, forzar reflow y leer el computed style.
      el.style.fontSize = ""
      void el.offsetHeight
      const computed = parseFloat(getComputedStyle(el).fontSize)
      if (Number.isFinite(computed)) inheritedSizeRef.current = computed

      // (2) Punto de partida: max explícito o heredado (nunca bajo min).
      const inherited = inheritedSizeRef.current ?? FALLBACK_SIZE
      const base =
        typeof max === "number" && Number.isFinite(max) ? max : inherited
      let size = Math.max(min, base)
      el.style.fontSize = `${size}px`

      // (3) Bucle iterativo midiendo con whiteSpace normal (el texto
      // puede envolver): el overflow horizontal se detecta igual con
      // scrollWidth > clientWidth.
      let iterations = 0
      while (
        iterations < MAX_ITERATIONS &&
        size > min &&
        (el.scrollHeight > el.clientHeight + TOLERANCE ||
          el.scrollWidth > el.clientWidth + TOLERANCE)
      ) {
        size = Math.max(min, size - STEP_PX)
        el.style.fontSize = `${size}px`
        iterations += 1
      }
      // Si tras el bucle aún no cabe (size llegó a min) y hay `lines`,
      // el line-clamp aplicado vía style se encarga del recorte.
    }

    /** Debounce con rAF: coalesce ráfagas de callbacks en un solo ajuste. */
    const schedule = () => {
      if (disposed) return
      if (raf == null) raf = requestAnimationFrame(runFit)
    }

    // Ajuste inicial síncrono (antes de pintar: evita parpadeo) y en cada
    // cambio de children/props relevantes (vía deps del efecto).
    runFit()

    const observers: ResizeObserver[] = []

    if (typeof ResizeObserver !== "undefined") {
      // TIEMPO REAL: observar el CONTENEDOR — rotación, resize de ventana,
      // cambios de layout (apertura de paneles, grid que se re-compone…).
      // Como runFit relee el heredado en cada pase, también re-escala
      // hacia ARRIBA cuando vuelve a haber espacio.
      const containerObserver = new ResizeObserver(() => {
        retries = RETRY_FRAMES
        schedule()
      })
      containerObserver.observe(el)
      observers.push(containerObserver)

      // Cambios del font-size heredado: el padre suele cambiar de caja
      // cuando cambia su tipografía; al re-ajustar se re-lee el heredado.
      const parent = el.parentElement
      if (parent) {
        const parentObserver = new ResizeObserver(schedule)
        parentObserver.observe(parent)
        observers.push(parentObserver)
      }
    }

    // Tipografías web que cargan tarde cambian las métricas del texto:
    // re-ajustar cuando las fuentes estén listas.
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(() => schedule())
    }

    return () => {
      disposed = true
      cancelFrame()
      for (const observer of observers) observer.disconnect()
      el.style.fontSize = ""
    }
  }, [children, disabled, min, max, lines, as])

  // Render inicial SSR-safe: texto normal con fontSize heredado (sin
  // inline). Si hay `lines`, el line-clamp se aplica desde el primer
  // render para que el recorte también funcione sin JS.
  const style: CSSProperties = lines
    ? {
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        display: "-webkit-box",
        overflow: "hidden",
      }
    : {}

  // Etiqueta dinámica tipada (todas las opciones son intrínsecas).
  const Tag: ElementType = as

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        // Callback ref tipado: la etiqueta es dinámica (span, p, h3…),
        // así que normalizamos a HTMLElement para el contenedor medible.
        containerRef.current = node
      }}
      className={cn("block min-w-0 overflow-hidden", className)}
      style={style}
    >
      {children}
    </Tag>
  )
}

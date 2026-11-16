"use client"

// ============================================================
// ALQEMIA — FitText · Regla general anti-desborde v2
// ------------------------------------------------------------
// Problema original: en móviles, textos dentro de contenedores
// de tamaño limitado (tarjetas de logros, chips, stats) se
// DESBORDABAN porque el font-size no cabía.
//
// Problema v2 (bug real en iPhone/Safari): la medición clásica
// con scrollWidth/scrollHeight NO funciona en WebKit cuando el
// elemento usa display:-webkit-box (line-clamp): el overflow de
// las líneas internas NO se propaga al scroll* del contenedor,
// el bucle nunca detecta el desborde y el texto queda a tamaño
// completo saliéndose de la tarjeta.
//
// Solución v2 (a prueba de motores):
//  · MEDICIÓN CON RANGE API: document.createRange() sobre los
//    contenidos mide los rects REALES del texto renderizado
//    (incluye líneas que sobresalen del caja) en TODOS los
//    motores (Blink, WebKit, Gecko). Es la única medición que
//    WebKit no puede esconder.
//  · MEDICIÓN SIN QUIEBRE: durante el ajuste se desactiva
//    overflow-wrap para que las palabras largas midan su ancho
//    completo → el bucle encoje la fuente hasta que la palabra
//    más larga quepa ENTERA (nada de cortar "Transmutaci-ón").
//  · RED DE SEGURIDAD ESTRUCTURAL: si ni al tamaño mínimo cabe,
//    se activa overflow-wrap:break-word → la palabra se quiebra
//    DENTRO de la caja. Desbordarse hacia afuera es imposible.
//  · TIEMPO REAL: ResizeObserver (contenedor + padre) para
//    rotación/resize/cambios de layout, re-lectura del tamaño
//    heredado en cada pase (re-escala también hacia ARRIBA) y
//    re-ajuste cuando las fuentes web terminan de cargar.
//    Sin setState → cero re-renders (todo por style directo).
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
/** Tolerancia (px) al comparar medidas (ignora sub-píxeles). */
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
     * MEDICIÓN a prueba de motores (Range API): devuelve el rect
     * real del texto renderizado (unión de todas sus líneas, haya
     * o no desborde visible). A diferencia de scrollWidth /
     * scrollHeight, WebKit no puede ocultarlo dentro de un
     * -webkit-box con line-clamp.
     */
    const measureRange = (): DOMRect | null => {
      try {
        const range = document.createRange()
        range.selectNodeContents(el)
        const rect = range.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return null
        return rect
      } catch {
        return null
      }
    }

    /** ¿El texto desborda su caja (horizontal o verticalmente)? */
    const hasOverflow = (): boolean => {
      const rect = measureRange()
      if (rect) {
        return (
          rect.width > el.clientWidth + TOLERANCE ||
          rect.height > el.clientHeight + TOLERANCE
        )
      }
      // Fallback clásico por si el Range no estuviera disponible.
      return (
        el.scrollWidth > el.clientWidth + TOLERANCE ||
        el.scrollHeight > el.clientHeight + TOLERANCE
      )
    }

    /**
     * AJUSTE (regla general anti-desborde):
     *  1. Se limpia NUESTRO fontSize inline y se fuerza reflow para
     *     leer el font-size heredado real, sin contaminarlo con el
     *     ajuste de la pasada anterior.
     *  2. Se parte de `max` (si viene) o del heredado leído.
     *  3. Bucle: mientras haya desborde (medido con Range) y
     *     size > min, se reduce 0.5px y se re-mide.
     *  4. Si al llegar a `min` todavía no cabe, se activa el
     *     quiebre de palabra (break-word) → jamás se desborda.
     */
    const runFit = () => {
      raf = null
      if (disposed) return
      if (disabled) {
        // Desactivado: no tocar nada, fontSize natural (heredado).
        el.style.fontSize = ""
        el.style.overflowWrap = ""
        el.style.wordBreak = ""
        return
      }
      // El contenedor aún no tiene ancho (layout pendiente o
      // display:none): reintentar en el próximo frame (acotado; el
      // ResizeObserver cubre el caso de que gane tamaño más tarde).
      if (el.clientWidth <= 0) {
        if (retries > 0) {
          retries -= 1
          raf = requestAnimationFrame(runFit)
        }
        return
      }

      // (1) Tamaño heredado limpio + medición SIN quiebres de
      // palabra: las palabras largas miden su ancho completo para
      // que el bucle las haga caber ENTERAS.
      el.style.fontSize = ""
      el.style.overflowWrap = "normal"
      el.style.wordBreak = "normal"
      void el.offsetHeight
      const computed = parseFloat(getComputedStyle(el).fontSize)
      if (Number.isFinite(computed)) inheritedSizeRef.current = computed

      // (2) Punto de partida: max explícito o heredado (nunca bajo min).
      const inherited = inheritedSizeRef.current ?? FALLBACK_SIZE
      const base =
        typeof max === "number" && Number.isFinite(max) ? max : inherited
      let size = Math.max(min, base)
      el.style.fontSize = `${size}px`

      // (3) Bucle iterativo (el texto puede envolver; el Range
      // detecta tanto la línea demasiado ancha como el exceso
      // vertical, en cualquier motor).
      let iterations = 0
      while (iterations < MAX_ITERATIONS && size > min && hasOverflow()) {
        size = Math.max(min, size - STEP_PX)
        el.style.fontSize = `${size}px`
        iterations += 1
      }

      // (4) Red de seguridad: si ni al mínimo cabe, permitir el
      // quiebre de palabra DENTRO de la caja (mejor partir una
      // palabra que desbordarse). El line-clamp recorta lo
      // vertical; lo horizontal no puede salirse.
      if (size <= min && hasOverflow()) {
        el.style.overflowWrap = "break-word"
      } else {
        el.style.overflowWrap = ""
      }
      el.style.wordBreak = ""
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
      // TIEMPO REAL: observar el CONTENEDOR — rotación, resize de
      // ventana, cambios de layout (apertura de paneles, grid que
      // se re-compone…). Como runFit relee el heredado en cada
      // pase, también re-escala hacia ARRIBA cuando hay espacio.
      const containerObserver = new ResizeObserver(() => {
        retries = RETRY_FRAMES
        schedule()
      })
      containerObserver.observe(el)
      observers.push(containerObserver)

      // Cambios del font-size heredado: el padre suele cambiar de
      // caja cuando cambia su tipografía; al re-ajustar se re-lee
      // el heredado.
      const parent = el.parentElement
      if (parent) {
        const parentObserver = new ResizeObserver(schedule)
        parentObserver.observe(parent)
        observers.push(parentObserver)
      }
    }

    // Tipografías web que cargan tarde cambian las métricas del
    // texto: re-ajustar cuando las fuentes estén listas.
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(() => schedule())
    }

    return () => {
      disposed = true
      cancelFrame()
      for (const observer of observers) observer.disconnect()
      el.style.fontSize = ""
      el.style.overflowWrap = ""
      el.style.wordBreak = ""
    }
  }, [children, disabled, min, max, lines, as])

  // Render inicial SSR-safe: texto normal con fontSize heredado
  // (sin inline). Si hay `lines`, el line-clamp se aplica desde el
  // primer render para que el recorte también funcione sin JS (y
  // la regla global break-word de globals.css evita cualquier
  // desborde horizontal antes de la hidratación).
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

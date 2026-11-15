// ============================================================
// ALQEMIA — Letrero propio (lettering institucional)
// El alfabeto de la marca dibujado trazo a trazo, tal como
// aparece en el logotipo: A sin barra (Λ), E como tres barras
// (Ξ), Q con cola, M puntiaguda con vértice en la base.
// Oro líquido sobre el negro del Hub. Se usa en TODA la
// identidad: wordmark, títulos de sección y portadas.
// El espaciado es ÓPTICO: se calcula con la tinta real de
// cada glifo para que el tracking sea uniforme en cualquier
// palabra (como en el logotipo original).
// ============================================================

import { useId } from "react"
import { Sparkle } from "lucide-react"
import { cn } from "@/lib/utils"

// ---- Glifos: cada carácter vive en una celda de 100×100 ----
// Trazos (stroke) puros · mayúsculas geométricas de la marca.
const GLYPHS: Record<string, string> = {
  A: "M 8 100 L 50 4 L 92 100", // Λ — sin barra transversal
  B: "M 24 4 V 96 M 24 4 H 52 C 75 4 84 16 84 28 C 84 40 75 51 52 51 H 24 M 24 51 H 56 C 77 51 86 63 86 74 C 86 86 77 96 56 96 H 24",
  C: "M 80 20 C 66 7 38 5 24 22 C 12 36 12 64 24 78 C 38 95 66 93 80 80",
  D: "M 24 4 V 96 M 24 4 H 48 C 76 8 84 28 84 50 C 84 72 76 92 48 96 H 24",
  E: "M 14 6 H 86 M 14 50 H 70 M 14 94 H 86", // Ξ — tres barras, sin asta
  F: "M 26 4 V 96 M 26 4 H 84 M 26 50 H 68",
  G: "M 80 22 C 64 6 32 6 20 24 C 10 38 10 64 20 78 C 34 95 70 92 82 74 M 82 74 H 54",
  H: "M 20 4 V 96 M 80 4 V 96 M 20 50 H 80",
  I: "M 50 4 V 96",
  J: "M 64 4 V 68 C 64 88 50 98 34 94 C 24 92 18 84 20 74",
  K: "M 24 4 V 96 M 76 4 L 28 54 M 44 42 L 82 96",
  L: "M 24 4 V 96 H 90",
  M: "M 6 100 L 24 4 L 50 96 L 76 4 L 94 100", // vértice medio hasta la base
  N: "M 20 96 V 4 L 80 96 V 4",
  O: "M 50 4 C 74 4 86 24 86 50 C 86 76 74 96 50 96 C 26 96 14 76 14 50 C 14 24 26 4 50 4",
  P: "M 24 4 V 96 M 24 4 H 52 C 74 4 84 16 84 29 C 84 42 74 55 52 55 H 24",
  Q: "M 50 4 C 74 4 86 24 86 50 C 86 76 74 96 50 96 C 26 96 14 76 14 50 C 14 24 26 4 50 4 M 66 66 L 97 97", // aro + cola prominente
  R: "M 24 4 V 96 M 24 4 H 52 C 74 4 84 16 84 29 C 84 42 74 55 52 55 H 24 M 48 55 L 82 96",
  S: "M 80 24 C 68 8 34 8 26 22 C 18 36 32 45 50 49 C 68 53 83 62 79 77 C 75 93 38 95 20 82",
  T: "M 12 4 H 88 M 50 4 V 96",
  U: "M 22 4 V 62 C 22 84 36 96 50 96 C 64 96 78 84 78 62 V 4",
  V: "M 10 4 L 50 96 L 90 4",
  W: "M 6 4 L 26 96 L 50 22 L 74 96 L 94 4",
  X: "M 16 4 L 84 96 M 84 4 L 16 96",
  Y: "M 14 4 L 50 50 L 86 4 M 50 50 V 96",
  Z: "M 16 4 H 84 L 16 96 H 84",
  Ñ: "M 20 100 V 22 L 80 100 V 22 M 31 13 C 39 3 47 5 51 10 C 55 15 63 17 70 9",
  // ---- dígitos ----
  "0": "M 50 6 C 71 6 81 25 81 50 C 81 75 71 94 50 94 C 29 94 19 75 19 50 C 19 25 29 6 50 6",
  "1": "M 32 20 L 52 4 V 96",
  "2": "M 22 26 C 26 8 62 2 76 16 C 90 30 66 56 50 72 L 18 96 H 82",
  "3": "M 22 16 C 38 2 70 4 78 20 C 86 36 66 46 50 50 C 70 52 88 62 82 78 C 76 94 40 98 20 84",
  "4": "M 66 96 V 4 L 16 66 H 84",
  "5": "M 74 4 H 26 L 22 46 C 42 38 70 42 78 58 C 86 76 70 96 46 96 C 30 96 20 90 14 80",
  "6": "M 70 6 C 42 2 22 26 19 58 C 16 84 32 98 51 96 C 70 94 80 74 72 60 C 64 46 38 44 27 57",
  "7": "M 16 4 H 84 L 44 96",
  "8": "M 50 4 C 66 4 74 14 74 26 C 74 40 58 46 50 46 C 42 46 26 40 26 26 C 26 14 34 4 50 4 M 50 46 C 42 46 20 54 20 72 C 20 88 34 96 50 96 C 66 96 80 88 80 72 C 80 54 58 46 50 46",
  "9": "M 30 94 C 58 98 78 74 81 42 C 84 16 68 2 49 4 C 30 6 20 26 28 40 C 36 54 62 56 73 43",
  // ---- puntuación (trazos mínimos, cap redondo = punto) ----
  "·": "M 50 50 L 50.01 50",
  ".": "M 50 94 L 50.01 94",
  ",": "M 54 86 L 44 100",
  ":": "M 50 36 L 50.01 36 M 50 78 L 50.01 78",
  "!": "M 50 4 V 62 M 50 90 L 50.01 90",
  "¡": "M 50 96 V 38 M 50 10 L 50.01 10",
  "?": "M 26 34 C 26 8 74 6 76 30 C 77 48 54 52 52 68 M 52 90 L 52.01 90",
  "¿": "M 74 66 C 74 92 26 94 24 70 C 23 52 46 48 48 32 M 48 10 L 48.01 10",
  "-": "M 26 52 H 74",
  "—": "M 14 52 H 86",
  "'": "M 54 2 L 46 16",
  "(": "M 68 2 C 42 26 42 74 68 98",
  ")": "M 32 2 C 58 26 58 74 32 98",
  "+": "M 50 22 V 78 M 22 50 H 78",
}

// Extremos de tinta (x) de cada glifo dentro de su celda, para
// el kerning óptico: [left, right]. Letras no listadas usan [18, 82].
const INK: Record<string, [number, number]> = {
  A: [8, 92], B: [24, 86], C: [12, 81], D: [24, 84], E: [14, 86],
  F: [26, 84], G: [10, 84], H: [20, 80], I: [50, 50], J: [18, 64],
  K: [24, 82], L: [24, 90], M: [6, 94], N: [20, 80], O: [14, 86],
  P: [24, 84], Q: [14, 97], R: [24, 82], S: [19, 81], T: [12, 88],
  U: [22, 78], V: [10, 90], W: [6, 94], X: [16, 84], Y: [14, 86],
  Z: [16, 84], Ñ: [20, 80],
  "0": [19, 81], "1": [32, 52], "2": [18, 82], "3": [20, 83], "4": [16, 84],
  "5": [14, 78], "6": [17, 80], "7": [16, 84], "8": [20, 80], "9": [19, 81],
  "·": [46, 54], ".": [46, 54], ",": [46, 54], ":": [46, 54], "!": [46, 54],
  "¡": [46, 54], "?": [24, 77], "¿": [23, 76], "-": [26, 74], "—": [14, 86],
  "'": [46, 54], "(": [42, 68], ")": [32, 58], "+": [22, 78],
}

const DEFAULT_INK: [number, number] = [18, 82]
const GAP = 30 // separación óptica entre letras (tracking de la marca)
const SPACE_ADVANCE = 46

// Acentos → letra base (el letrero es puramente mayúscula)
const ACCENTS: Record<string, string> = {
  Á: "A", À: "A", Ä: "A", Â: "A", Ã: "A",
  É: "E", È: "E", Ë: "E", Ê: "E",
  Í: "I", Ì: "I", Ï: "I", Î: "I",
  Ó: "O", Ò: "O", Ö: "O", Ô: "O", Õ: "O",
  Ú: "U", Ù: "U", Ü: "U", Û: "U",
}

function normalize(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((ch) => ACCENTS[ch] ?? ch)
    .join("")
}

export type AlqemiaTone = "gold" | "bright" | "mono"

const TONES: Record<Exclude<AlqemiaTone, "mono">, { offset: number; color: string }[]> = {
  gold: [
    { offset: 0, color: "#F8E08E" },
    { offset: 0.45, color: "#D4AF37" },
    { offset: 1, color: "#A8762A" },
  ],
  bright: [
    { offset: 0, color: "#FFF6CF" },
    { offset: 0.5, color: "#F5D77A" },
    { offset: 1, color: "#D4AF37" },
  ],
}

/**
 * Renderiza cualquier texto con la letra propia de ALQEMIA
 * (trazos SVG dorados). Se dimensiona por el font-size del
 * contexto (como si fuera texto): la altura visual es ~1em.
 */
export function AlqemiaLetters({
  text,
  className,
  tone = "gold",
  strokeWidth = 7.5,
  animate = false,
  delay = 0,
  step = 0.05,
  shine = false,
  glow = false,
  ariaLabel,
}: {
  text: string
  className?: string
  tone?: AlqemiaTone
  /** Grosor del trazo en unidades de la celda (más alto = más grueso). Úsalo mayor en tamaños pequeños. */
  strokeWidth?: number
  /** Entrada escalonada letra por letra */
  animate?: boolean
  delay?: number
  step?: number
  /** Barrido periódico de brillo sobre el oro */
  shine?: boolean
  /** Halo dorado sutil */
  glow?: boolean
  ariaLabel?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const gid = `alq-g-${uid}`
  const mid = `alq-m-${uid}`
  const sid = `alq-s-${uid}`

  // --- Kerning óptico: cada glifo se coloca por su tinta real ---
  const chars = normalize(text).split("")
  const placed: { ch: string; x: number }[] = []
  let cursor = 6
  for (const ch of chars) {
    if (ch === " ") {
      cursor += SPACE_ADVANCE
      continue
    }
    if (!GLYPHS[ch]) continue // carácter sin glifo: se omite
    const [left, right] = INK[ch] ?? DEFAULT_INK
    placed.push({ ch, x: cursor - left })
    cursor += right - left + GAP
  }
  const width = Math.max(24, cursor - GAP + 6)

  const stroke = tone === "mono" ? "currentColor" : `url(#${gid})`
  const stops = TONES[tone === "mono" ? "gold" : tone]

  return (
    <span
      className={cn("relative inline-block align-baseline", glow && "alq-glow", className)}
      role="img"
      aria-label={ariaLabel ?? text}
    >
      <svg
        viewBox={`0 0 ${width} 100`}
        className="alq-letters"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {tone !== "mono" && (
            <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
              {stops.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          )}
          {shine && (
            <>
              <mask id={mid} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height="100">
                {placed.map(({ ch, x }, i) => (
                  <path
                    key={i}
                    d={GLYPHS[ch]}
                    transform={`translate(${x} 0)`}
                    stroke="#ffffff"
                    strokeWidth={strokeWidth + 1.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </mask>
              <linearGradient id={sid} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="0.42" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#FFF7D0" stopOpacity="0.9" />
                <stop offset="0.58" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </>
          )}
        </defs>

        {placed.map(({ ch, x }, i) => (
          <g key={i} transform={`translate(${x} 0)`}>
            <path
              d={GLYPHS[ch]}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={animate ? "alq-glyph animate-letter-in" : "alq-glyph"}
              style={animate ? { animationDelay: `${delay + i * step}s` } : undefined}
            />
          </g>
        ))}

        {shine && (
          <g mask={`url(#${mid})`}>
            <rect
              className="alq-sheen-rect"
              x="0"
              y="-20"
              width={width}
              height="140"
              fill={`url(#${sid})`}
            />
          </g>
        )}
      </svg>
    </span>
  )
}

/**
 * El wordmark institucional: ALQEMIA en la letra de la marca,
 * con entrada cinética, barrido de brillo y destello final.
 */
export function AlqemiaWordmark({
  className,
  delay = 0.2,
  animate = true,
  shine = true,
  sparkle = true,
  tone = "gold",
  strokeWidth = 7.5,
}: {
  className?: string
  delay?: number
  animate?: boolean
  shine?: boolean
  sparkle?: boolean
  tone?: AlqemiaTone
  strokeWidth?: number
}) {
  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      role="img"
      aria-label="ALQEMIA"
    >
      <AlqemiaLetters
        text="ALQEMIA"
        tone={tone}
        strokeWidth={strokeWidth}
        animate={animate}
        delay={delay}
        shine={shine}
        glow
      />
      {sparkle && (
        <Sparkle
          aria-hidden="true"
          className="animate-sparkle-pop absolute -right-3.5 -top-1 h-2.5 w-2.5 text-gold-bright"
          style={{ animationDelay: `${delay + 0.62}s` }}
        />
      )}
    </span>
  )
}

/**
 * El emblema de la marca: dos trazos de oro que convergen
 * (la gran A / la montaña) con la esfera alquímica anidada
 * bajo el arco. Es la marca de avatar, iconos y cabeceras.
 */
export function AlqemiaMark({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const gid = `alqk-${uid}`
  const bid = `alqb-${uid}`
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8E08E" />
          <stop offset="0.5" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#8C5A1E" />
        </linearGradient>
        <radialGradient id={bid} cx="0.35" cy="0.3" r="0.95">
          <stop offset="0" stopColor="#FFF6CF" />
          <stop offset="0.55" stopColor="#E9C25A" />
          <stop offset="1" stopColor="#9C6B1F" />
        </radialGradient>
      </defs>
      {/* Trazo izquierdo: ancho, curvado hacia el ápice */}
      <path d="M 4 94 C 20 62 34 32 45 8 L 57 8 C 46 36 32 64 24 94 Z" fill={`url(#${gid})`} />
      {/* Trazo derecho: barrido hacia afuera, abriéndose en la base */}
      <path d="M 96 94 C 80 62 66 32 55 8 L 43 8 C 54 36 68 64 76 94 Z" fill={`url(#${gid})`} />
      {/* Esfera alquímica bajo el arco */}
      <circle cx="50" cy="66" r="9" fill={`url(#${bid})`} />
    </svg>
  )
}

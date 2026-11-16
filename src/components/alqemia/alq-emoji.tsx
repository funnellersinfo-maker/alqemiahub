"use client"

// ============================================================
// ALQEMIA — Emojis alquímicos del gremio
// Catálogo de 24 símbolos propios dibujados como SVG line-art.
// En las reseñas de los usuarios se guardan como tokens [a:xxx]
// dentro del texto plano; AlqText() los detecta y pinta el glifo
// inline. Nada de emojis unicode: solo la iconografía del gremio.
// ============================================================

import type { JSX, ReactNode } from "react"

// ------------------------------------------------------------
// Catálogo de símbolos (token · nombre · significado)
// ------------------------------------------------------------

export type AlqEmojiDef = { token: string; name: string; meaning: string }

export const ALQ_EMOJIS: AlqEmojiDef[] = [
  { token: "sol", name: "Sol", meaning: "Claridad, éxito, visibilidad de marca" },
  { token: "luna", name: "Luna", meaning: "Intuición, ciclos de lanzamiento" },
  { token: "ignis", name: "Ignis (Fuego)", meaning: "Pasión, creatividad que convierte" },
  { token: "aqua", name: "Aqua (Agua)", meaning: "Fluidez, adaptación al mercado" },
  { token: "aer", name: "Aer (Aire)", meaning: "Ideas, difusión del mensaje" },
  { token: "terra", name: "Terra (Tierra)", meaning: "Solidez, operación y sistemas" },
  { token: "mercurius", name: "Mercurius", meaning: "Comunicación, venta rápida" },
  { token: "sulphur", name: "Sulphur", meaning: "Ambición, el alma del negocio" },
  { token: "sal", name: "Sal", meaning: "Estructura, lo esencial" },
  { token: "azoth", name: "Azoth", meaning: "El secreto de la transformación" },
  { token: "quinta", name: "Quinta Essentia", meaning: "La esencia: tu propuesta de valor" },
  { token: "ouroboros", name: "Ouroboros", meaning: "Ciclos eternos, mejora continua" },
  { token: "athanor", name: "Athanor", meaning: "El horno: constancia diaria" },
  { token: "alembic", name: "Alembic", meaning: "Destilación de ideas" },
  { token: "crucibulum", name: "Crisol", meaning: "Pruebas y experimentos" },
  { token: "caduceus", name: "Caduceus", meaning: "Negociación, acuerdos" },
  { token: "lapis", name: "Lapis Philosophorum", meaning: "La gran obra: negocio próspero" },
  { token: "cinnabaris", name: "Cinnabaris", meaning: "Materia prima: datos reales" },
  { token: "vitriolum", name: "Vitriolum", meaning: "Refinamiento del copy" },
  { token: "antimonium", name: "Antimonium", meaning: "Protección, anti-frágil" },
  { token: "alkahest", name: "Alkahest", meaning: "El disolvente universal" },
  { token: "elixir", name: "Elixir", meaning: "El producto que todo lo cura" },
  { token: "stella", name: "Stella", meaning: "Guía, visión de futuro" },
  { token: "clavis", name: "Clavis", meaning: "La llave del código" },
]

// Mapa token -> definición (para validar tokens rápido)
export const ALQ_EMOJI_MAP: Record<string, AlqEmojiDef> = Object.fromEntries(
  ALQ_EMOJIS.map((def) => [def.token, def] as const)
)

// Regex compartido para detectar tokens [a:xxx] en un texto.
// Con split() el grupo capturado queda en las posiciones impares del array.
export const ALQ_EMOJI_RE: RegExp = /\[a:([a-z]+)\]/g

// ------------------------------------------------------------
// Trazos de cada símbolo
// ------------------------------------------------------------
// Geometría en viewBox 0 0 24 24: círculos, triángulos, barras y
// curvas simples, con al menos 2 elementos por glifo para que se
// lea "alquímico" y cada símbolo sea reconocible a 10px de alto.

const ALQ_GLYPHS: Record<string, ReactNode> = {
  // Sol: disco con ocho rayos
  sol: (
    <>
      <circle cx="12" cy="12" r="3.9" />
      <path d="M12 3.4v2.9M12 17.7v2.9M3.4 12h2.9M17.7 12h2.9M16 8L18.1 5.9M8 8L5.9 5.9M8 16L5.9 18.1M16 16L18.1 18.1" />
    </>
  ),
  // Luna: creciente con destello
  luna: (
    <>
      <path d="M12 3a6.36 6.36 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      <path d="M16.6 3.4l1.05 1.4 1.15.8-1.15.8-1.05 1.4-1.05-1.4-1.15-.8 1.15-.8 1.05-1.4Z" />
    </>
  ),
  // Ignis: triángulo hacia arriba con núcleo
  ignis: (
    <>
      <path d="M12 4L19.5 19H4.5Z" />
      <circle cx="12" cy="13.8" r="1.05" />
    </>
  ),
  // Aqua: triángulo hacia abajo con núcleo
  aqua: (
    <>
      <path d="M4.5 5h15L12 20Z" />
      <circle cx="12" cy="10.2" r="1.05" />
    </>
  ),
  // Aer: triángulo arriba atravesado por una barra
  aer: (
    <>
      <path d="M12 4L19.5 19H4.5Z" />
      <path d="M8.5 11.5h7" />
    </>
  ),
  // Terra: triángulo abajo atravesado por una barra
  terra: (
    <>
      <path d="M4.5 5h15L12 20Z" />
      <path d="M8.5 12.5h7" />
    </>
  ),
  // Mercurius: cuernos sobre círculo y cruz debajo
  mercurius: (
    <>
      <path d="M8 3a4.5 4.5 0 0 0 8 0" />
      <circle cx="12" cy="9.4" r="3.8" />
      <path d="M12 13.2v7.3M8.3 17h7.4" />
    </>
  ),
  // Sulphur: triángulo sobre cruz
  sulphur: (
    <>
      <path d="M12 3.8L16 10H8Z" />
      <path d="M12 10v10.6M8 16.6h8" />
    </>
  ),
  // Sal: círculo con barra horizontal
  sal: (
    <>
      <circle cx="12" cy="12" r="6.6" />
      <path d="M5.4 12h13.2" />
    </>
  ),
  // Azoth: círculo con punto radiante en el centro
  azoth: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <circle cx="12" cy="12" r="1.1" />
      <path d="M12 7.6v1.9M12 14.5v1.9M7.6 12h1.9M14.5 12h1.9" />
    </>
  ),
  // Quinta Essentia: estrella de 8 puntas dentro de círculo
  quinta: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 4.6L19.4 12 12 19.4 4.6 12Z" />
      <path d="M7.2 7.2h9.6v9.6H7.2Z" />
    </>
  ),
  // Ouroboros: serpiente que se muerde la cola (cabeza triangular con ojo)
  ouroboros: (
    <>
      <path d="M10.2 5.2A7 7 0 1 0 14.4 5.4" />
      <path d="M11.5 5.3L14.9 3.6 15.7 6.9Z" />
      <circle cx="14.1" cy="5.3" r="0.55" />
    </>
  ),
  // Athanor: horno con domo, base y puerta
  athanor: (
    <>
      <path d="M5 17.5a7 7 0 0 1 14 0" />
      <path d="M3.8 17.5h16.4" />
      <path d="M9.9 17.5v-2a2.1 2.1 0 0 1 4.2 0v2" />
    </>
  ),
  // Alembic: matraz de cuello largo con líquido y burbuja
  alembic: (
    <>
      <path d="M9.7 3.5v6.9l-3.8 4.3a7.2 7.2 0 1 0 12.2 0l-3.8-4.3V3.5" />
      <path d="M8 16.5h8" />
      <circle cx="16.6" cy="5.8" r="1.5" />
    </>
  ),
  // Crisol: copa en U sobre tres patas
  crucibulum: (
    <>
      <path d="M6.5 4.5v8a5.5 5.5 0 0 0 11 0v-8" />
      <path d="M8.2 16L7 20.7M12 18v2.7M15.8 16L17 20.7" />
    </>
  ),
  // Caduceus: vara con curvas entrelazadas y orbe superior
  caduceus: (
    <>
      <circle cx="12" cy="4.6" r="1.9" />
      <path d="M12 6.5v14" />
      <path d="M12 8.8c-3.9 0-3.9 4.8 0 4.8c3.9 0 3.9 4.8 0 4.8" />
    </>
  ),
  // Lapis Philosophorum: rombo dentro de círculo
  lapis: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M12 6L18 12 12 18 6 12Z" />
    </>
  ),
  // Cinnabaris: dos triángulos entrelazados con núcleo
  cinnabaris: (
    <>
      <path d="M12 4.2L20.2 18.4H3.8Z" />
      <path d="M12 19.8L3.8 5.6h16.4Z" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  // Vitriolum: círculo con V interior
  vitriolum: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M8.4 9.3l3.6 6.5 3.6-6.5" />
    </>
  ),
  // Antimonium: círculo con gancho superior
  antimonium: (
    <>
      <circle cx="12" cy="14" r="5.8" />
      <path d="M12 8.2V6.3a2.9 2.9 0 0 1 5.8 0v1.7" />
    </>
  ),
  // Alkahest: gota con estrella interior
  alkahest: (
    <>
      <path d="M12 3.4c3.3 4.4 6.1 7.4 6.1 10.5a6.1 6.1 0 0 1-12.2 0c0-3.1 2.8-6.1 6.1-10.5Z" />
      <path d="M12 11.1l1.25 1.65 1.65 1.25-1.65 1.25-1.25 1.65-1.25-1.65-1.65-1.25 1.65-1.25L12 11.1Z" />
    </>
  ),
  // Elixir: cáliz con dos burbujas
  elixir: (
    <>
      <path d="M6.8 4.3v3.3L12 13.9l5.2-6.3V4.3" />
      <path d="M12 13.9v5.7M8.3 19.6h7.4" />
      <circle cx="9.4" cy="2.9" r="1.3" />
      <circle cx="14.8" cy="2.5" r="0.9" />
    </>
  ),
  // Stella: pentagrama con núcleo
  stella: (
    <>
      <path d="M12 6.2L3.4 18L17.3 7.9L6.7 7.9L20.6 18Z" />
      <circle cx="12" cy="15.2" r="1.15" />
    </>
  ),
  // Clavis: llave vertical con anillo y dientes
  clavis: (
    <>
      <circle cx="12" cy="5.7" r="2.7" />
      <path d="M12 8.4V20M12 14.3h2.5M12 20h3.3v-2.5" />
    </>
  ),
}

// Renderiza un token como SVG inline (null si el token no existe)
function _render(token: string): JSX.Element | null {
  const glyph = ALQ_GLYPHS[token]
  if (!glyph) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="block h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  )
}

// ------------------------------------------------------------
// Componentes
// ------------------------------------------------------------

// Glifo individual. El tamaño lo controla el className del span
// contenedor (por defecto hereda 1.15em del font-size del texto).
export function AlqEmoji({ token, className }: { token: string; className?: string }): JSX.Element | null {
  const glyph = _render(token)
  if (!glyph) return null
  return <span className={className ? `inline-block leading-none ${className}` : "inline-block leading-none"}>{glyph}</span>
}

// Clases para embeber un glifo dentro de un párrafo:
// alineado al texto, con centrado óptico leve y respiro horizontal.
const ALQ_INLINE_CLASS = "mx-px inline-block h-[1.15em] w-[1.15em] translate-y-[0.1em]"

// Renderiza texto con tokens [a:xxx]: los conocidos se convierten en
// glifos inline, los desconocidos se muestran tal cual y el resto del
// texto se respeta (saltos de línea incluidos si el contenedor usa
// whitespace-pre-wrap). Si el texto está vacío → null.
export function AlqText({ text, className }: { text: string; className?: string }): JSX.Element | null {
  if (!text) return null

  // split() con regex capturadora devuelve [texto, token, texto, token, ...]:
  // las posiciones impares son siempre el grupo ([a-z]+) capturado.
  const parts = text.split(ALQ_EMOJI_RE)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          if (ALQ_EMOJI_MAP[part]) {
            return <AlqEmoji key={i} token={part} className={ALQ_INLINE_CLASS} />
          }
          // Token desconocido → se muestra literalmente
          return <span key={i}>{`[a:${part}]`}</span>
        }
        // Segmento de texto plano (su whitespace lo gestiona el contenedor)
        return part || null
      })}
    </span>
  )
}

// Grid selector de símbolos para el diálogo de editar perfil
export function AlqEmojiPicker({ onPick }: { onPick: (token: string) => void }): JSX.Element {
  return (
    <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-2 sm:grid-cols-8">
      {ALQ_EMOJIS.map((def) => (
        <button
          key={def.token}
          type="button"
          title={`${def.name} — ${def.meaning}`}
          aria-label={`Insertar ${def.name}`}
          onClick={() => onPick(def.token)}
          className="flex aspect-square items-center justify-center rounded-lg text-zinc-400 ring-1 ring-transparent transition-colors hover:bg-gold/10 hover:text-gold-bright hover:ring-gold/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
        >
          <AlqEmoji token={def.token} className="h-5 w-5" />
        </button>
      ))}
    </div>
  )
}

// ============================================================
// Genera TODOS los iconos PWA de ALQEMIA con la letra propia
// (los mismos glifos del letrero institucional) + el emblema Λ.
//   · icon-192 / icon-512            → propósito "any"
//   · icon-maskable-192 / -512       → zona segura circular
//   · apple-touch-icon               → iOS 180×180
//   · src/app/icon.png, apple-icon   → favicon metadata de Next
// Ejecutar: bun scripts/gen-icons.mjs
// ============================================================
import sharp from "sharp"
import { mkdirSync } from "fs"

// ---- Glifos de la marca (copiados de alqemia-lettering.tsx) ----
const GLYPHS = {
  A: "M 8 100 L 50 4 L 92 100", // Λ — sin barra
  L: "M 24 4 V 96 H 90",
  Q: "M 50 4 C 74 4 86 24 86 50 C 86 76 74 96 50 96 C 26 96 14 76 14 50 C 14 24 26 4 50 4 M 66 66 L 97 97",
  E: "M 14 6 H 86 M 14 50 H 70 M 14 94 H 86", // Ξ — tres barras
  M: "M 6 100 L 24 4 L 50 96 L 76 4 L 94 100", // vértice en la base
  I: "M 50 4 V 96",
}

// Extremos de tinta [left, right] por glifo (kerning óptico)
const INK = {
  A: [8, 92], L: [24, 90], Q: [14, 97], E: [14, 86], M: [6, 94], I: [50, 50],
}
const GAP = 30

/** Coloca los glifos y devuelve { placed, width } en unidades de celda 100 */
function layoutWordmark(text) {
  const chars = text.split("")
  const placed = []
  let cursor = 6
  for (const ch of chars) {
    const [left, right] = INK[ch]
    placed.push({ ch, x: cursor - left })
    cursor += right - left + GAP
  }
  return { placed, width: cursor - GAP + 6 }
}

const WM = layoutWordmark("ALQEMIA") // ≈ 669×100

// ---- Emblema Λ (los mismos trazos de AlqemiaMark) ----
const EMBLEM = `
  <path d="M 4 94 C 20 62 34 32 45 8 L 57 8 C 46 36 32 64 24 94 Z" fill="url(#goldV)"/>
  <path d="M 96 94 C 80 62 66 32 55 8 L 43 8 C 54 36 68 64 76 94 Z" fill="url(#goldV)"/>
  <circle cx="50" cy="66" r="9" fill="url(#orb)"/>
`

/**
 * SVG plano del icono: fondo negro con halo dorado + emblema Λ
 * arriba + wordmark ALQEMIA abajo, con las proporciones indicadas.
 * maskable=true → contenido más recogido (zona segura circular 80%).
 */
function iconSvg(size, { maskable = false } = {}) {
  // ---- proporciones del contenido (en unidades de 512) ----
  const U = size / 512
  let emblemH, wmW
  if (maskable) {
    emblemH = 150 * U
    wmW = 320 * U
  } else {
    emblemH = 185 * U
    wmW = 370 * U
  }
  const wmH = (wmW / WM.width) * 100 // alto del wordmark a partir del ancho
  const gap = (maskable ? 22 : 30) * U
  const blockH = emblemH + gap + wmH
  const top = (size - blockH) / 2
  const embX = (size - emblemH) / 2 // el emblema es cuadrado (celda 100×100)
  const wmX = (size - wmW) / 2
  const wmY = top + emblemH + gap
  const strokeW = 100 * (wmW / WM.width) * 0.132 // trazo ≈13% de la celda

  const letters = WM.placed.map(
    ({ ch, x }) =>
      `<path transform="translate(${x} 0)" d="${GLYPHS[ch]}" fill="none" stroke="url(#goldW)" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("\n    ")

  const r = Math.round(size * 0.18)
  const border = maskable
    ? ""
    : `<rect x="${Math.max(1, size / 170)}" y="${Math.max(1, size / 170)}" width="${size - 2 * Math.max(1, size / 170)}" height="${size - 2 * Math.max(1, size / 170)}" rx="${r}" fill="none" stroke="#D4AF37" stroke-opacity="0.30" stroke-width="${Math.max(1, size / 96)}"/>`

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.40" r="0.78">
      <stop offset="0" stop-color="#1A1510"/>
      <stop offset="0.55" stop-color="#0C0A08"/>
      <stop offset="1" stop-color="#060606"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.46" r="0.52">
      <stop offset="0" stop-color="#D4AF37" stop-opacity="0.20"/>
      <stop offset="0.65" stop-color="#D4AF37" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#D4AF37" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F8E08E"/>
      <stop offset="0.5" stop-color="#D4AF37"/>
      <stop offset="1" stop-color="#8C5A1E"/>
    </linearGradient>
    <radialGradient id="orb" cx="0.35" cy="0.3" r="0.95">
      <stop offset="0" stop-color="#FFF6CF"/>
      <stop offset="0.55" stop-color="#E9C25A"/>
      <stop offset="1" stop-color="#9C6B1F"/>
    </radialGradient>
    <linearGradient id="goldW" gradientUnits="userSpaceOnUse" x1="0" y1="${wmY}" x2="0" y2="${wmY + wmH}">
      <stop offset="0" stop-color="#F8E08E"/>
      <stop offset="0.45" stop-color="#D4AF37"/>
      <stop offset="1" stop-color="#A8762A"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="#060606"/>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#halo)"/>
  ${border}
  <g transform="translate(${embX} ${top}) scale(${emblemH / 100})">${EMBLEM}</g>
  <g transform="translate(${wmX} ${wmY}) scale(${wmW / WM.width})">
    ${letters}
  </g>
</svg>`
}

const targets = [
  ["public/icon-192.png", 192, false],
  ["public/icon-512.png", 512, false],
  ["public/icon-maskable-192.png", 192, true],
  ["public/icon-maskable-512.png", 512, true],
  ["public/apple-touch-icon.png", 180, false],
  ["src/app/icon.png", 512, false],
  ["src/app/apple-icon.png", 180, false],
]

mkdirSync("public", { recursive: true })
for (const [out, size, maskable] of targets) {
  await sharp(Buffer.from(iconSvg(size, { maskable }))).png().toFile(out)
  console.log("ok", out, size + "px" + (maskable ? " (maskable)" : ""))
}
console.log("Iconos ALQEMIA generados con la letra propia")

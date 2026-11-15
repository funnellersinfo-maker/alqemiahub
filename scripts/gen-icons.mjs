// Genera los iconos PWA con el emblema ALQEMIA (Λ dorada + esfera)
// Fondo negro #070707 con halo dorado sutil. Ejecutar: bun scripts/gen-icons.mjs
import sharp from "sharp"
import { mkdirSync } from "fs"

const MARK = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F8E08E"/>
      <stop offset="0.5" stop-color="#D4AF37"/>
      <stop offset="1" stop-color="#8C5A1E"/>
    </linearGradient>
    <radialGradient id="b" cx="0.35" cy="0.3" r="0.95">
      <stop offset="0" stop-color="#FFF6CF"/>
      <stop offset="0.55" stop-color="#E9C25A"/>
      <stop offset="1" stop-color="#9C6B1F"/>
    </radialGradient>
  </defs>
  <path d="M 4 94 C 20 62 34 32 45 8 L 57 8 C 46 36 32 64 24 94 Z" fill="url(#s)"/>
  <path d="M 96 94 C 80 62 66 32 55 8 L 43 8 C 54 36 68 64 76 94 Z" fill="url(#s)"/>
  <circle cx="50" cy="66" r="9" fill="url(#b)"/>
</svg>`

/** Compone el SVG final: fondo + halo + marca centrada */
function iconSvg(size, markScale = 0.72) {
  const m = size * markScale
  const off = (size - m) / 2
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#171310"/>
      <stop offset="0.55" stop-color="#0B0908"/>
      <stop offset="1" stop-color="#070707"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#D4AF37" stop-opacity="0.22"/>
      <stop offset="0.7" stop-color="#D4AF37" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#D4AF37" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="url(#halo)"/>
  <rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${Math.round(size * 0.18)}" fill="none" stroke="#D4AF37" stroke-opacity="0.28" stroke-width="${Math.max(1, size / 96)}"/>
  <g transform="translate(${off} ${off}) scale(${m / 100})">${MARK}
  </g>
</svg>`
}

const targets = [
  ["public/icon-192.png", 192, 0.74],
  ["public/icon-512.png", 512, 0.74],
  ["public/icon-maskable-192.png", 192, 0.62],
  ["public/icon-maskable-512.png", 512, 0.62],
  ["public/apple-touch-icon.png", 180, 0.7],
  ["src/app/icon.png", 512, 0.74],
  ["src/app/apple-icon.png", 180, 0.7],
]

mkdirSync("public", { recursive: true })
for (const [out, size, scale] of targets) {
  await sharp(Buffer.from(iconSvg(size, scale))).png().toFile(out)
  console.log("ok", out, size + "px")
}
console.log("Iconos ALQEMIA generados")

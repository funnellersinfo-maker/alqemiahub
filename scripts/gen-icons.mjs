// ============================================================
// Genera TODOS los iconos PWA de ALQEMIA a partir del LOGO REAL
// de la entrada (public/images/logo-mark.png — el sello Λ dorado
// con la esfera sobre negro, sin letras). El ícono descargado es
// EXACTAMENTE el mismo logo que ve el usuario al cruzar la puerta.
//
// Cuadrado completamente opaco (sin transparencias ni esquinas
// redondeadas): el sistema operativo lo recorta con su propia
// máscara y JAMÁS aparece el "cuadro blanco" al abrir la app —
// la pantalla de arranque queda negra continua (como el Hub).
//
// El sello ocupa ~57% del lienzo con ~22-27% de márgenes → cabe
// dentro de la zona segura circular (80%) de los maskable.
//
// Ejecutar: bun scripts/gen-icons.mjs
// ============================================================
import sharp from "sharp"

const SOURCE = "public/images/logo-mark.png" // el logo real de la entrada

// [salida, tamaño] — todos usan el logo real tal cual (redimensionado)
const targets = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/icon-maskable-192.png", 192],
  ["public/icon-maskable-512.png", 512],
  ["public/apple-touch-icon.png", 180],
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 180],
]

for (const [out, size] of targets) {
  await sharp(SOURCE)
    .resize(size, size, { fit: "cover", position: "centre" })
    .flatten({ background: "#000000" }) // garantiza opacidad total
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log("ok", out, size + "px")
}
console.log("Iconos ALQEMIA = logo real de la entrada (sin letras)")

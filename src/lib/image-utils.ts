"use client"

// ============================================================
// ALQEMIA — Utilidades de imagen del lado cliente
// Compresión a JPEG con tamaño máximo (para portadas 16:9,
// comprobantes de pago y avatares)
// ============================================================

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB de archivo original

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
    reader.readAsDataURL(file)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"))
    img.src = src
  })
}

/** Comprime cualquier imagen a JPEG con ancho máximo y recorte centrado al aspecto pedido. */
export async function compressImage(
  file: File,
  opts: { maxWidth?: number; aspect?: number | null; quality?: number } = {}
): Promise<string> {
  const { maxWidth = 1000, aspect = null, quality = 0.8 } = opts
  const rawDataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(rawDataUrl)

  let sx = 0
  let sy = 0
  let sWidth = img.naturalWidth
  let sHeight = img.naturalHeight

  // Recorte centrado al aspecto (p. ej. 16/9); null = conservar el original
  if (aspect && aspect > 0) {
    const target = aspect
    const current = sWidth / sHeight
    if (current > target) {
      sWidth = Math.round(sHeight * target)
      sx = Math.round((img.naturalWidth - sWidth) / 2)
    } else {
      sHeight = Math.round(sWidth / target)
      sy = Math.round((img.naturalHeight - sHeight) / 2)
    }
  }

  const outW = Math.min(maxWidth, sWidth)
  const outH = Math.round((outW / sWidth) * sHeight)

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas no disponible")
  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outW, outH)
  return canvas.toDataURL("image/jpeg", quality)
}

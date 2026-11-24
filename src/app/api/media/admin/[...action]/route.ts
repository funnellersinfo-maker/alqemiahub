// ============================================================
// /api/media/admin/[...action] — Subida de vídeos por TROCES
// ------------------------------------------------------------
// PRODUCCIÓN: estas rutas NO se ejecutan — el portal (Pages)
// enruta todo /api/media/* al worker alqemia-media (R2). Este
// archivo es el gemelo local para DESARROLLO (bun run dev):
// mismos endpoints sobre disco (.data/media), para que el
// flujo del panel admin funcione idéntico en dev y prod.
// ============================================================

import { NextRequest } from "next/server"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"

type Ctx = { params: Promise<{ action?: string[] }> }

const PART_BYTES = 8 * 1024 * 1024
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024 * 1024
const MAX_PUT_BYTES = 3 * 1024 * 1024

const MURO_VIDEO_RE = /^muro\/muro-video(-v\d{1,15})?\.(mp4|webm|mov)$/
const LESSON_RE = /^lessons\/[a-z0-9-]{6,64}\.(mp4|webm|mov)$/
const IMAGE_RE =
  /^(muro\/muro-poster(-v\d{1,15})?|posters\/[a-z0-9-]{6,64}|posts\/[a-z0-9-]{6,64})\.(jpe?g|png|webp)$/
const VIDEO_TYPES = /^video\/(mp4|webm|quicktime)(;.*)?$/i
const IMAGE_TYPES = /^image\/(jpe?g|png|webp)(;.*)?$/i

function keyKnown(key: string): boolean {
  return MURO_VIDEO_RE.test(key) || LESSON_RE.test(key) || IMAGE_RE.test(key)
}

async function uploadsDir(): Promise<string> {
  const { join } = await import("node:path")
  return join(process.cwd(), ".data", "media", ".uploads")
}

async function finalPath(key: string): Promise<string> {
  const { join } = await import("node:path")
  return join(process.cwd(), ".data", "media", ...key.split("/"))
}

/** POST /api/media/admin/upload-begin  {key, contentType, size} */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const { action } = await ctx.params
    const route = (action ?? []).join("/")

    if (route === "upload-begin") {
      const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
      const key = typeof body.key === "string" ? body.key : ""
      const contentType = typeof body.contentType === "string" ? body.contentType : ""
      const size = typeof body.size === "number" ? body.size : 0
      if (!keyKnown(key)) return errorResponse(400, "Clave de archivo inválida")
      if (!VIDEO_TYPES.test(contentType) && !IMAGE_TYPES.test(contentType)) {
        return errorResponse(415, "Formato no soportado")
      }
      if (!Number.isFinite(size) || size <= 0) return errorResponse(400, "Tamaño inválido")
      if (size > MAX_UPLOAD_BYTES) return errorResponse(413, "El archivo supera el máximo de 1,5 GB")

      const { mkdir, writeFile } = await import("node:fs/promises")
      const uploadId = crypto.randomUUID()
      const dir = await uploadsDir()
      await mkdir(dir, { recursive: true })
      await writeFile(`${dir}/${uploadId}.json`, JSON.stringify({ key, contentType, size, parts: 0 }))
      return Response.json({ ok: true, uploadId, chunkHint: PART_BYTES })
    }

    if (route === "upload-complete") {
      const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
      const uploadId = typeof body.uploadId === "string" ? body.uploadId : ""
      const key = typeof body.key === "string" ? body.key : ""
      if (!uploadId || !keyKnown(key)) return errorResponse(400, "Solicitud inválida")

      const { readFile, rm, mkdir, rename, stat } = await import("node:fs/promises")
      const dir = await uploadsDir()
      let meta: { key?: string; contentType?: string; size?: number; parts?: number }
      try {
        meta = JSON.parse(await readFile(`${dir}/${uploadId}.json`, "utf8")) as typeof meta
      } catch {
        return errorResponse(404, "Subida no encontrada o caducada")
      }
      if (!meta.key || meta.key !== key) return errorResponse(400, "La subida no coincide con la clave")
      const bytes = await stat(`${dir}/${uploadId}`).then((s) => s.size).catch(() => 0)
      if (bytes === 0) return errorResponse(400, "Subida vacía")

      const dest = await finalPath(key)
      await mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true })
      await rename(`${dir}/${uploadId}`, dest)
      await rm(`${dir}/${uploadId}.json`, { force: true })
      return Response.json({ ok: true, url: `/api/media/${key}`, signed: `/api/media/${key}`, bytes })
    }

    if (route === "upload-abort") {
      const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
      const uploadId = typeof body.uploadId === "string" ? body.uploadId : ""
      if (!uploadId) return errorResponse(400, "Solicitud inválida")
      const { rm } = await import("node:fs/promises")
      const dir = await uploadsDir()
      await rm(`${dir}/${uploadId}`, { force: true })
      await rm(`${dir}/${uploadId}.json`, { force: true })
      return Response.json({ ok: true })
    }

    return errorResponse(404, "Acción desconocida")
  } catch (e) {
    return handleApiError(e)
  }
}

/** PUT /api/media/admin/upload-part?uploadId=..&key=..&n=..  (cuerpo = trozo) */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const { action } = await ctx.params
    const route = (action ?? []).join("/")
    const url = new URL(req.url)

    if (route === "upload-part") {
      const uploadId = url.searchParams.get("uploadId") ?? ""
      const key = url.searchParams.get("key") ?? ""
      const n = Number(url.searchParams.get("n") ?? "0")
      if (!uploadId || !keyKnown(key)) return errorResponse(400, "Solicitud inválida")
      if (!Number.isInteger(n) || n < 1 || n > 10000) return errorResponse(400, "Trozo inválido")
      if (!req.body) return errorResponse(400, "Trozo vacío")

      const { appendFile, readFile, writeFile, mkdir } = await import("node:fs/promises")
      const dir = await uploadsDir()
      await mkdir(dir, { recursive: true })
      const metaPath = `${dir}/${uploadId}.json`
      let meta: { key?: string; parts?: number }
      try {
        meta = JSON.parse(await readFile(metaPath, "utf8")) as typeof meta
      } catch {
        return errorResponse(404, "Subida no encontrada o caducada")
      }
      // Los trozos se escriben en orden estricto (append simple y rápido)
      if ((meta.parts ?? 0) + 1 !== n) {
        return errorResponse(409, "Trozo fuera de orden")
      }

      const buf = Buffer.from(await req.arrayBuffer())
      if (buf.byteLength === 0) return errorResponse(400, "Trozo vacío")
      if (buf.byteLength > 16 * 1024 * 1024) return errorResponse(413, "Trozo demasiado grande")
      await appendFile(`${dir}/${uploadId}`, buf)
      await writeFile(metaPath, JSON.stringify({ ...meta, parts: n }))
      return Response.json({ ok: true, etag: `dev-${n}`, partNumber: n })
    }

    if (route === "put") {
      const key = url.searchParams.get("key") ?? ""
      if (!IMAGE_RE.test(key)) return errorResponse(400, "Clave inválida (solo imágenes)")
      const contentType = req.headers.get("content-type") ?? ""
      if (!IMAGE_TYPES.test(contentType)) return errorResponse(415, "Formato no soportado")
      const buf = Buffer.from(await req.arrayBuffer())
      if (buf.byteLength === 0) return errorResponse(400, "Archivo vacío")
      if (buf.byteLength > MAX_PUT_BYTES) return errorResponse(413, "Imagen demasiado grande")
      const { mkdir, writeFile } = await import("node:fs/promises")
      const dest = await finalPath(key)
      await mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true })
      await writeFile(dest, buf)
      return Response.json({ ok: true, url: `/api/media/${key}`, signed: `/api/media/${key}`, bytes: buf.byteLength })
    }

    return errorResponse(404, "Acción desconocida")
  } catch (e) {
    return handleApiError(e)
  }
}

/** DELETE /api/media/admin/delete?key=.. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "Acceso restringido al titular")
    const { action } = await ctx.params
    if ((action ?? []).join("/") !== "delete") return errorResponse(404, "Acción desconocida")

    const key = new URL(req.url).searchParams.get("key") ?? ""
    if (!keyKnown(key)) return errorResponse(400, "Clave inválida")
    const { rm } = await import("node:fs/promises")
    const dest = await finalPath(key)
    await rm(dest, { force: true })
    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

// ============================================================
// MEDIA CLIENT — Subida de medios desde el navegador
// ------------------------------------------------------------
// VÍDEOS (admin): subida por TROCES de 8 MB (multipart) → sin
// límite de 100 MB por petición → hasta 1,5 GB por vídeo con
// progreso real y reintento automático por trozo.
//   · Producción: el portal enruta /api/media/* al worker R2.
//   · Desarrollo: las mismas rutas caen en las API de Next
//     (almacenamiento en disco local .data/media).
// IMÁGENES DE MIEMBROS (muro): token corto de la app + PUT.
// ============================================================

const PART_BYTES = 8 * 1024 * 1024
const MAX_PART_ATTEMPTS = 3

export type UploadProgress = (pct: number) => void

function adminKey(): string {
  try {
    return localStorage.getItem("alqemia-admin-key") ?? ""
  } catch {
    return ""
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) {
      if (data.error === "too-large") return "El archivo supera el máximo permitido"
      return data.error
    }
  } catch {
    /* respuesta sin JSON */
  }
  return `Error ${res.status}`
}

/**
 * Sube un vídeo por trozos con barra de progreso real.
 * Devuelve la URL interna limpia (para guardar en la BD).
 */
export async function uploadVideoChunked(opts: {
  key: string
  file: File
  contentType: string
  onProgress?: UploadProgress
  signal?: AbortSignal
}): Promise<{ url: string; signed?: string; bytes: number }> {
  const { key, file, contentType, onProgress, signal } = opts
  const size = file.size

  // 1) begin
  const beginRes = await fetch("/api/media/admin/upload-begin", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": adminKey() },
    body: JSON.stringify({ key, contentType, size }),
    signal,
  })
  if (!beginRes.ok) throw new Error(await readError(beginRes))
  const begin = (await beginRes.json()) as { uploadId: string }
  const uploadId = begin.uploadId

  let uploaded = 0
  const parts: { etag: string; partNumber: number }[] = []
  const totalParts = Math.ceil(size / PART_BYTES)

  // 2) partes (reintento por trozo: redes móviles inestables)
  for (let n = 1; n <= totalParts; n++) {
    const start = (n - 1) * PART_BYTES
    const blob = file.slice(start, Math.min(start + PART_BYTES, size))
    let etag: string | null = null
    let lastErr: Error | null = null
    for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
      if (signal?.aborted) {
        void abortUpload(uploadId, key)
        throw new Error("Subida cancelada")
      }
      try {
        const res = await fetch(
          `/api/media/admin/upload-part?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&n=${n}`,
          {
            method: "PUT",
            headers: { "content-type": "application/octet-stream", "x-admin-key": adminKey() },
            body: blob,
            signal,
          }
        )
        if (!res.ok) throw new Error(await readError(res))
        const data = (await res.json()) as { etag: string; partNumber: number }
        etag = data.etag
        break
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error("Error de red")
        if (signal?.aborted) break
        await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
    if (!etag) {
      void abortUpload(uploadId, key)
      throw new Error(lastErr?.message ?? "No se pudo subir el trozo del vídeo")
    }
    parts.push({ etag, partNumber: n })
    uploaded += blob.size
    onProgress?.(Math.min(100, Math.round((uploaded / size) * 100)))
  }

  // 3) complete
  const completeRes = await fetch("/api/media/admin/upload-complete", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": adminKey() },
    body: JSON.stringify({ uploadId, key, parts }),
    signal,
  })
  if (!completeRes.ok) throw new Error(await readError(completeRes))
  const done = (await completeRes.json()) as { url: string; signed?: string; bytes: number }
  return { url: done.url, signed: done.signed, bytes: done.bytes }
}

async function abortUpload(uploadId: string, key: string): Promise<void> {
  try {
    await fetch("/api/media/admin/upload-abort", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": adminKey() },
      body: JSON.stringify({ uploadId, key }),
    })
  } catch {
    /* limpieza best-effort */
  }
}

/** Subida pequeña de una vez (portadas admin: posters/) — imagen ya comprimida. */
export async function uploadImageAsAdmin(opts: {
  key: string
  blob: Blob
  onProgress?: UploadProgress
}): Promise<{ url: string; signed?: string }> {
  const { key, blob, onProgress } = opts
  onProgress?.(10)
  const res = await fetch(`/api/media/admin/put?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "content-type": blob.type || "image/jpeg",
      "x-admin-key": adminKey(),
    },
    body: blob,
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as { url: string; signed?: string }
  onProgress?.(100)
  return { url: data.url, signed: data.signed }
}

/**
 * Subida de imagen por un MIEMBRO del gremio (publicaciones del muro).
 * Pide a la app un token de 10 min (requiere sesión iniciada) y sube
 * directo al almacén de medios → el muro deja de viajar en JSON gigante.
 */
export async function uploadMemberImage(opts: {
  key: string
  blob: Blob
}): Promise<{ url: string; signed?: string }> {
  const { key, blob } = opts
  const tokenRes = await fetch("/api/uploader/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  })
  if (!tokenRes.ok) throw new Error(await readError(tokenRes))
  const token = (await tokenRes.json()) as { t?: string; e?: number; dev?: boolean }

  const query = new URLSearchParams({ key })
  if (token.t && token.e) {
    query.set("t", token.t)
    query.set("e", String(token.e))
  }
  const res = await fetch(`/api/media/member/upload?${query.toString()}`, {
    method: "PUT",
    headers: { "content-type": blob.type || "image/jpeg" },
    body: blob,
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as { url: string; signed?: string }
  return { url: data.url, signed: data.signed }
}

/** Elimina un medio del titular (R2 + legado DO). */
export async function deleteMediaByKey(key: string): Promise<void> {
  await fetch(`/api/media/admin/delete?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: { "x-admin-key": adminKey() },
  }).catch(() => {})
}

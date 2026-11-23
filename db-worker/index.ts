// ============================================================
// ALQEMIA HUB — Durable Object de base de datos (alqemia-db)
// SQLite real y con consistencia fuerte dentro de Cloudflare.
// Expone una API SQL mínima por HTTP:
//   POST /sql   { sql, params, mode: raw|run|exec }
//   GET  /health
//   POST /admin/reseed  { key }
// Se auto-inicializa (esquema + datos iniciales) en la primera petición.
// ============================================================

import { DurableObject } from "cloudflare:workers"
import SCHEMA_SQL from "./schema.sql"
import SEED_SQL from "./seed.sql"

interface Env {
  HUB_DB: DurableObjectNamespace
  DB_ADMIN_KEY?: string
}

type SqlMode = "raw" | "run" | "exec"

interface SqlPayload {
  sql: string
  params?: unknown[]
  mode: SqlMode
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

type SqlLike = {
  exec: (q: string, ...p: unknown[]) => {
    toArray: () => unknown[]
    columnNames: string[]
    rowsWritten: number
  }
}

/** Divide un script SQL en sentencias individuales y quita las líneas
 *  de comentario (-- ...). Los INSERT del seed son de una línea y el
 *  DDL termina en ";\n", así que dividir por ";" + salto es seguro. */
function splitStatements(script: string): string[] {
  return script
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter((s) => s.length > 0)
}

/** Ejecuta un script SQL sentencia por sentencia (modo robusto). */
function execScript(sql: SqlLike, script: string): void {
  for (const stmt of splitStatements(script)) {
    if (stmt.startsWith("PRAGMA")) continue // per-conexión; no aplica aquí
    sql.exec(stmt)
  }
}

// v2 — EN VIVO + MARKETPLACE + ASISTENTE IA. Idempotente: CREATE TABLE
// IF NOT EXISTS / CREATE INDEX IF NOT EXISTS. Seguro sobre bases con datos.
const MIGRATION_V2_SQL = `
CREATE TABLE IF NOT EXISTS "LiveSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverImage" TEXT,
    "streamUrl" TEXT,
    "replayUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "LiveSession_status_idx" ON "LiveSession"("status");
CREATE INDEX IF NOT EXISTS "LiveSession_scheduledAt_idx" ON "LiveSession"("scheduledAt");

CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "commissionPct" INTEGER NOT NULL DEFAULT 50,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "coverImage" TEXT,
    "contentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX IF NOT EXISTS "Product_sellerId_idx" ON "Product"("sellerId");

CREATE TABLE IF NOT EXISTS "ProductFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductFavorite_userId_productId_key" ON "ProductFavorite"("userId", "productId");
CREATE INDEX IF NOT EXISTS "ProductFavorite_productId_idx" ON "ProductFavorite"("productId");

CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerContact" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "commission" REAL NOT NULL DEFAULT 0,
    "proofImage" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Sale_resellerId_idx" ON "Sale"("resellerId");
CREATE INDEX IF NOT EXISTS "Sale_productId_idx" ON "Sale"("productId");
CREATE INDEX IF NOT EXISTS "Sale_status_idx" ON "Sale"("status");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");
`

// v3 — INVITACIONES (registro solo por código del titular). Idempotente.
const MIGRATION_V3_SQL = `
CREATE TABLE IF NOT EXISTS "InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "usedAt" DATETIME,
    "usedById" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InviteCode_code_key" ON "InviteCode"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "InviteCode_email_key" ON "InviteCode"("email");
CREATE INDEX IF NOT EXISTS "InviteCode_email_idx" ON "InviteCode"("email");
CREATE INDEX IF NOT EXISTS "InviteCode_createdAt_idx" ON "InviteCode"("createdAt");
`

// v4 — PERFIL PÚBLICO + ORÁCULO CON CONVERSACIONES + REPORTE DE RESULTADOS.
// Idempotente: CREATE IF NOT EXISTS + ALTER con try/catch + UPDATE condicional.
const MIGRATION_V4_SQL = `
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
`

// v4 — Reconstrucción de ChatMessage con conversaciones e imágenes.
// Se ejecuta SOLO sobre tablas viejas (sin columna conversationId) y
// conserva todos los mensajes existentes.
const MIGRATION_V4_CHAT_SQL = `
CREATE TABLE "ChatMessage_v4" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "imagePrompt" TEXT,
    "imageSize" TEXT,
    "imageData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "ChatMessage_v4" ("id","userId","conversationId","role","content","kind","imagePrompt","imageSize","imageData","createdAt") SELECT "id","userId",NULL,"role","content",'text',NULL,NULL,NULL,"createdAt" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "ChatMessage_v4" RENAME TO "ChatMessage";
CREATE INDEX IF NOT EXISTS "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
`

// v5 — EL GRIMORIO (códigos estilo GitHub) + AJUSTES del hub.
// Idempotente: CREATE TABLE IF NOT EXISTS, seguro sobre bases con datos.
const MIGRATION_V5_SQL = `
CREATE TABLE IF NOT EXISTS "CodeSnippet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'texto',
    "fileName" TEXT NOT NULL DEFAULT 'codigo.txt',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "content" TEXT NOT NULL,
    "tags" TEXT,
    "forksCount" INTEGER NOT NULL DEFAULT 0,
    "forkedFromId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CodeSnippet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CodeSnippet_userId_idx" ON "CodeSnippet"("userId");
CREATE INDEX IF NOT EXISTS "CodeSnippet_visibility_updatedAt_idx" ON "CodeSnippet"("visibility", "updatedAt");

CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
`

// v6 — MEDIOS (vídeos subidos por el titular: muro y lecciones).
// Los archivos se guardan troceados en blobs de 1 MiB para respetar
// los límites de SQLite en Durable Objects. Idempotente.
const MIGRATION_V6_MEDIA_SQL = `
CREATE TABLE IF NOT EXISTS "MediaMeta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL DEFAULT 'video/mp4',
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "MediaChunk" (
    "key" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    PRIMARY KEY ("key", "idx")
);
`

// ============================================================
// Medios — constantes y helpers
// ============================================================

/** Tamaño de cada trozo almacenado en SQLite (1 MiB). */
const MEDIA_CHUNK = 1_048_576
/** Tope por archivo (el límite de subida de Cloudflare son 100 MB). */
const MAX_MEDIA_BYTES = 95 * 1024 * 1024
/** Claves válidas: muro/muro-video.{mp4|webm|mov} o lessons/{id}.{ext} */
const MEDIA_KEY_RE = /^(muro\/muro-video|lessons\/[a-z0-9-]{6,64})\.(mp4|webm|mov)$/

function mediaKeyOk(key: string): boolean {
  return MEDIA_KEY_RE.test(key)
}

function contentTypeFor(key: string): string {
  if (key.endsWith(".webm")) return "video/webm"
  if (key.endsWith(".mov")) return "video/quicktime"
  return "video/mp4"
}

type MediaRange = { start: number; end: number }

/** Parsea una cabecera Range de bytes. null = sin rango, "invalid" = 416. */
function parseRangeHeader(header: string | null, size: number): MediaRange | null | "invalid" {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === "" && m[2] === "")) return "invalid"
  let start: number
  let end: number
  if (m[1] === "") {
    const suffix = Number(m[2])
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid"
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    if (!Number.isFinite(start) || start < 0) return "invalid"
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start > end || start >= size) return "invalid"
  return { start, end }
}

export class HubDB extends DurableObject {
  private initialized = false

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  private get sql(): SqlLike {
    return this.ctx.storage.sql as unknown as SqlLike
  }

  /** Crea el esquema y los datos iniciales si la base está vacía. */
  private ensureInit(): void {
    if (this.initialized) return
    const cursor = this.sql.exec(
      "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'User'"
    )
    const row = cursor.toArray()[0] as { n: number } | undefined
    if (!row || row.n === 0) {
      execScript(this.sql, SCHEMA_SQL)
      execScript(this.sql, SEED_SQL)
    }
    this.ensureMigrations()
    this.initialized = true
  }

  /** Migraciones idempotentes para bases ya inicializadas (no destruye datos). */
  private ensureMigrations(): void {
    // v1: columna User.experience (quiz de onboarding)
    try {
      this.sql.exec('ALTER TABLE "User" ADD COLUMN "experience" TEXT')
    } catch {
      // La columna ya existe: nada que hacer
    }
    // v2: EN VIVO + MARKETPLACE + ASISTENTE IA (CREATE TABLE IF NOT EXISTS:
    // crea lo que falte sin tocar las tablas ni los datos existentes)
    execScript(this.sql, MIGRATION_V2_SQL)
    // v3: columna User.tourCompletedAt (tour obligatorio del mapa). Si la
    // columna acaba de crearse, los miembros existentes ya conocen el hub:
    // se les marca el tour como completado para que solo lo vean los nuevos.
    try {
      this.sql.exec('ALTER TABLE "User" ADD COLUMN "tourCompletedAt" DATETIME')
      this.sql.exec('UPDATE "User" SET "tourCompletedAt" = CURRENT_TIMESTAMP')
    } catch {
      // La columna ya existe: nada que hacer
    }
    // v3: INVITACIONES (CREATE TABLE IF NOT EXISTS)
    execScript(this.sql, MIGRATION_V3_SQL)
    // ----------------------------------------------------------
    // v4: PERFIL PÚBLICO (portada + sello verificado) · ORÁCULO CON
    // CONVERSACIONES E IMÁGENES · REPORTE DE RESULTADOS EN POSTS
    // ----------------------------------------------------------
    execScript(this.sql, MIGRATION_V4_SQL) // Conversation + índice
    // User: portada pública y chulito azul verificado
    try {
      this.sql.exec('ALTER TABLE "User" ADD COLUMN "coverImage" TEXT')
    } catch {
      // la columna ya existe
    }
    try {
      this.sql.exec('ALTER TABLE "User" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false')
    } catch {
      // la columna ya existe
    }
    // El titular lleva el sello azul (los grandes maestres lo obtienen por XP)
    try {
      this.sql.exec('UPDATE "User" SET "verified" = 1 WHERE "role" = \'ADMIN\'')
    } catch {
      // nada que actualizar
    }
    // Post: métricas de resultados (evidencia al publicar, estilo Skool)
    try {
      this.sql.exec('ALTER TABLE "Post" ADD COLUMN "metricRevenue" REAL')
    } catch {
      // la columna ya existe
    }
    try {
      this.sql.exec('ALTER TABLE "Post" ADD COLUMN "metricOrders" INTEGER')
    } catch {
      // la columna ya existe
    }
    try {
      this.sql.exec('ALTER TABLE "Post" ADD COLUMN "metricRoas" REAL')
    } catch {
      // la columna ya existe
    }
    // ChatMessage: se reconstruye con conversaciones e imágenes.
    // Solo si aún no tiene la columna conversationId (bases viejas);
    // los mensajes existentes se conservan intactos.
    try {
      const cols = (
        this.sql.exec('SELECT "name" FROM pragma_table_info("ChatMessage")').toArray() as {
          name: string
        }[]
      ).map((r) => r.name)
      if (!cols.includes("conversationId")) {
        execScript(this.sql, MIGRATION_V4_CHAT_SQL)
      }
    } catch (e) {
      console.error("[alqemia-db] migración v4 ChatMessage:", e)
    }
    // El titular pasa a llamarse Alejo (solo si conserva el nombre del seed;
    // si él mismo lo cambió, no se toca)
    try {
      this.sql.exec(
        'UPDATE "User" SET "name" = \'Alejo\', "headline" = \'Titular · ALQEMIA\', "bio" = \'Titular del gremio [a:sol]. Transmuto comunidades en máquinas de vender [a:lapis]. Aquí evolucionamos con evidencia, no con humo [a:cinnabaris].\', "verified" = 1 WHERE "email" = \'admin@alqemia.com\' AND "name" = \'Admin ALQEMIA\''
      )
    } catch {
      // nada que renombrar
    }
    // v5: EL GRIMORIO + AJUSTES (CREATE TABLE IF NOT EXISTS)
    execScript(this.sql, MIGRATION_V5_SQL)
    // v6: MEDIOS (vídeos del titular troceados en blobs)
    execScript(this.sql, MIGRATION_V6_MEDIA_SQL)
    // v7: PORTADA (poster) propia de cada vídeo de lección. Idempotente:
    // si la columna ya existe, el ALTER falla y no se toca nada.
    try {
      this.sql.exec('ALTER TABLE "Lesson" ADD COLUMN "poster" TEXT')
    } catch {
      // la columna ya existe
    }
  }

  // ============================================================
  // MEDIOS — PUT (subida troceada) · GET/HEAD (Range en streaming)
  // · DELETE
  // ============================================================
  private async handleMedia(req: Request, url: URL): Promise<Response> {
    const key = decodeURIComponent(url.pathname.slice("/media/".length))
    if (!mediaKeyOk(key)) return json({ ok: false, error: "invalid-key" }, 400)

    // ---------- DELETE ----------
    if (req.method === "DELETE") {
      this.sql.exec("DELETE FROM MediaChunk WHERE key = ?", key)
      this.sql.exec("DELETE FROM MediaMeta WHERE key = ?", key)
      return json({ ok: true, key })
    }

    // ---------- PUT (subida) ----------
    if (req.method === "PUT") {
      const contentType = contentTypeFor(key)
      const declared = Number(req.headers.get("content-length") ?? "0")
      if (declared > MAX_MEDIA_BYTES) {
        return json({ ok: false, error: "too-large" }, 413)
      }
      if (!req.body) return json({ ok: false, error: "empty-body" }, 400)

      // Limpiar la versión previa (y, en el muro, cualquier extensión hermana)
      this.sql.exec("DELETE FROM MediaChunk WHERE key = ?", key)
      this.sql.exec("DELETE FROM MediaMeta WHERE key = ?", key)
      if (key.startsWith("muro/")) {
        this.sql.exec("DELETE FROM MediaChunk WHERE key LIKE 'muro/%'")
        this.sql.exec("DELETE FROM MediaMeta WHERE key LIKE 'muro/%'")
      }

      const cleanup = () => {
        this.sql.exec("DELETE FROM MediaChunk WHERE key = ?", key)
        this.sql.exec("DELETE FROM MediaMeta WHERE key = ?", key)
      }

      try {
        const reader = req.body.getReader()
        let total = 0
        let idx = 0
        let buf = new Uint8Array(MEDIA_CHUNK)
        let bufLen = 0

        const flush = (final: Uint8Array) => {
          this.sql.exec(
            "INSERT INTO MediaChunk (key, idx, data) VALUES (?, ?, ?)",
            key,
            idx,
            final
          )
          idx++
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue
          total += value.byteLength
          if (total > MAX_MEDIA_BYTES) throw new Error("too-large")
          let srcOff = 0
          while (srcOff < value.byteLength) {
            const copy = Math.min(buf.length - bufLen, value.byteLength - srcOff)
            buf.set(value.subarray(srcOff, srcOff + copy), bufLen)
            bufLen += copy
            srcOff += copy
            if (bufLen === buf.length) {
              flush(buf.slice())
              buf = new Uint8Array(MEDIA_CHUNK)
              bufLen = 0
            }
          }
        }
        if (bufLen > 0) flush(buf.slice(0, bufLen))
        if (total === 0) throw new Error("empty")

        this.sql.exec(
          "INSERT INTO MediaMeta (key, contentType, size) VALUES (?, ?, ?)",
          key,
          contentType,
          total
        )
        return json({ ok: true, key, bytes: total, chunks: idx })
      } catch (e) {
        cleanup()
        const msg = e instanceof Error ? e.message : String(e)
        if (msg === "too-large") return json({ ok: false, error: "too-large" }, 413)
        return json({ ok: false, error: `upload-failed: ${msg}` }, 500)
      }
    }

    // ---------- GET / HEAD ----------
    if (req.method === "GET" || req.method === "HEAD") {
      const metaRow = this.sql
        .exec("SELECT size FROM MediaMeta WHERE key = ?", key)
        .toArray()[0] as { size: number } | undefined
      if (!metaRow) return json({ ok: false, error: "not-found" }, 404)

      const size = metaRow.size
      const range = parseRangeHeader(req.headers.get("range"), size)
      if (range === "invalid") {
        return new Response(null, {
          status: 416,
          headers: {
            "content-range": `bytes */${size}`,
            "accept-ranges": "bytes",
          },
        })
      }
      const start = range ? range.start : 0
      const end = range ? range.end : size - 1
      const length = end - start + 1

      const headers: Record<string, string> = {
        "content-type": contentTypeFor(key),
        "accept-ranges": "bytes",
        "content-length": String(length),
        // CRÍTICO: el contenido parcial (206) JAMÁS se cachea — si el
        // navegador guarda un 206 y luego lo reutiliza para otro rango,
        // el vídeo se queda "pegado" y no vuelve a reproducirse. El 200
        // completo sí puede reutilizarse de la caché durante una hora.
        "cache-control": range ? "private, no-store" : "private, max-age=3600",
      }
      if (range) headers["content-range"] = `bytes ${start}-${end}/${size}`
      const status = range ? 206 : 200

      if (req.method === "HEAD") {
        return new Response(null, { status, headers })
      }

      // Streaming perezoso: un trozo por pull del ReadableStream
      const firstIdx = Math.floor(start / MEDIA_CHUNK)
      const lastIdx = Math.floor(end / MEDIA_CHUNK)
      let nextIdx = firstIdx
      const stream = new ReadableStream<Uint8Array>({
        pull: (controller) => {
          if (nextIdx > lastIdx) {
            controller.close()
            return
          }
          const chunkIdx = nextIdx
          const chunkOffset = chunkIdx * MEDIA_CHUNK
          const row = this.sql
            .exec("SELECT data FROM MediaChunk WHERE key = ? AND idx = ?", key, chunkIdx)
            .toArray()[0] as { data: ArrayBuffer | Uint8Array } | undefined
          if (!row) {
            controller.error(new Error("missing-chunk"))
            return
          }
          const bytes =
            row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data)
          nextIdx++
          const from = Math.max(0, start - chunkOffset)
          const to = Math.min(bytes.length, end - chunkOffset + 1)
          const slice = bytes.subarray(from, to)
          if (slice.byteLength > 0) controller.enqueue(slice)
        },
      })

      // CRÍTICO: workerd descarta Content-Length cuando el cuerpo es un
      // stream de longitud desconocida. Sin ese encabezado la caché
      // multimedia del navegador se degrada (reproducción "pegada").
      // FixedLengthStream declara el tamaño exacto → el encabezado
      // sobrevive hasta el cliente a través del worker y el portal.
      let body: ReadableStream<Uint8Array> = stream
      try {
        const fls = new FixedLengthStream(length)
        void stream.pipeTo(fls.writable).catch(() => {})
        body = fls.readable
      } catch {
        // sin FixedLengthStream → stream directo (content-length cae)
      }
      return new Response(body, { status, headers })
    }

    return json({ ok: false, error: "method-not-allowed" }, 405)
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === "/health") {
      this.ensureInit()
      return json({ ok: true, db: "alqemia-hub" })
    }

    // ============================================================
    // MEDIOS — subida/descarga/borrado de vídeos del titular
    // (solo alcanzable vía service binding desde el worker principal;
    // la entrada pública del worker NO enruta /media salvo que haya
    // DB_ADMIN_KEY configurada y coincida la cabecera x-db-key).
    // ============================================================
    if (url.pathname.startsWith("/media/")) {
      this.ensureInit()
      return this.handleMedia(req, url)
    }

    if (url.pathname === "/admin/reseed" && req.method === "POST") {
      const expected = (this.env as Env).DB_ADMIN_KEY
      if (!expected) return json({ ok: false, error: "reseed-disabled" }, 403)
      let key = ""
      try {
        const body = (await req.json()) as { key?: string }
        key = body.key ?? ""
      } catch {
        return json({ ok: false, error: "bad-request" }, 400)
      }
      if (key !== expected) return json({ ok: false, error: "unauthorized" }, 401)
      try {
        // Orden inverso al de creación: los hijos (FK) se eliminan antes
        // que sus padres para no violar claves foráneas.
        const tables = this.sql
          .exec(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY rowid DESC"
          )
          .toArray() as { name: string }[]
        for (const t of tables) {
          this.sql.exec(`DROP TABLE IF EXISTS "${t.name}"`)
        }
        this.initialized = false
        this.ensureInit()
        return json({ ok: true, reseeded: true })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return json({ ok: false, error: `reseed-failed: ${message}` })
      }
    }

    if (url.pathname === "/sql" && req.method === "POST") {
      this.ensureInit()
      let payload: SqlPayload
      try {
        payload = (await req.json()) as SqlPayload
      } catch {
        return json({ ok: false, error: "invalid-json" }, 400)
      }
      const { sql: query, params = [], mode } = payload
      if (typeof query !== "string" || !mode) {
        return json({ ok: false, error: "invalid-payload" }, 400)
      }
      try {
        if (mode === "exec") {
          this.sql.exec(query)
          return json({ ok: true, result: null })
        }
        const cursor = params.length > 0 ? this.sql.exec(query, ...params) : this.sql.exec(query)
        if (mode === "run") {
          cursor.toArray() // drenar para ejecutar la sentencia completa
          return json({ ok: true, result: { meta: { changes: cursor.rowsWritten } } })
        }
        // mode === "raw" → [columnNames, ...rows]
        const columnNames = [...cursor.columnNames]
        const objects = cursor.toArray() as Record<string, unknown>[]
        const rows = objects.map((obj) => columnNames.map((c) => obj[c]))
        return json({ ok: true, result: [columnNames, ...rows] })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return json({ ok: false, error: message })
      }
    }

    return json({ ok: false, error: "not-found" }, 404)
  }
}

/** Enrutador público del worker alqemia-db. Solo /health y /admin/reseed
 *  (protegido por DB_ADMIN_KEY) quedan expuestos: el worker principal
 *  (alqemiahub) habla con el DO de forma interna mediante el binding.
 *  /media solo se expone si DB_ADMIN_KEY está configurada (desarrollo
 *  local con wrangler dev) y exige la cabecera x-db-key correcta. */
const workerEntry: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === "/health" || url.pathname === "/admin/reseed") {
      const id = env.HUB_DB.idFromName("primary")
      const stub = env.HUB_DB.get(id)
      return stub.fetch(req)
    }
    if (url.pathname.startsWith("/media/")) {
      const expected = env.DB_ADMIN_KEY
      // Sin clave configurada (producción) → inaccesible desde fuera
      if (!expected || req.headers.get("x-db-key") !== expected) {
        return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        })
      }
      const id = env.HUB_DB.idFromName("primary")
      const stub = env.HUB_DB.get(id)
      return stub.fetch(req)
    }
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })
  },
}

export default workerEntry

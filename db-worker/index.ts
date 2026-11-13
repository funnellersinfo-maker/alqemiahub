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
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === "/health") {
      this.ensureInit()
      return json({ ok: true, db: "alqemia-hub" })
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
 *  (alqemiahub) habla con el DO de forma interna mediante el binding. */
const workerEntry: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === "/health" || url.pathname === "/admin/reseed") {
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

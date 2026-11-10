// ============================================================
// ALQEMIA HUB (Cloudflare) — Cliente SQL remoto
// Implementa la superficie de D1 que @prisma/adapter-d1 utiliza:
//   prepare(sql).bind(...).raw({ columnNames: true }) / .run() / .exec()
// El transporte es HTTP contra el Durable Object "alqemia-db"
// (SQLite real, fuerte consistencia, single-writer).
// ============================================================

export type SqlRpcResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string }

/** Endpoint SQL: función que envía {sql, params, mode} y devuelve la respuesta JSON. */
export type SqlTransport = (payload: {
  sql: string
  params: unknown[]
  mode: "raw" | "run" | "exec"
}) => Promise<SqlRpcResult>

class RemoteStatement {
  private params: unknown[] = []

  constructor(
    private transport: SqlTransport,
    private sql: string
  ) {}

  bind(...args: unknown[]): this {
    this.params = args
    return this
  }

  /** SELECT → [columnNames, ...rows] (formato D1 raw con columnNames) */
  async raw(_opts?: { columnNames?: boolean }): Promise<unknown[]> {
    const res = await this.transport({ sql: this.sql, params: this.params, mode: "raw" })
    if (!res.ok) throw new Error(res.error)
    return res.result as unknown[]
  }

  /** INSERT/UPDATE/DELETE → { meta: { changes } } */
  async run(): Promise<{ meta: { changes: number } }> {
    const res = await this.transport({ sql: this.sql, params: this.params, mode: "run" })
    if (!res.ok) throw new Error(res.error)
    return res.result as { meta: { changes: number } }
  }

  async all(): Promise<{ results: Record<string, unknown>[] }> {
    const rows = (await this.raw({ columnNames: true })) as unknown[]
    const [names, ...data] = rows as [string[], unknown[]]
    const results = (data as unknown[][]).map((row) => {
      const obj: Record<string, unknown> = {}
      names.forEach((n, i) => (obj[n] = row[i]))
      return obj
    })
    return { results }
  }

  async first<T = unknown>(): Promise<T | null> {
    const { results } = await this.all()
    return (results[0] as T) ?? null
  }
}

/** Objeto tipo "D1 Database" que enruta cada sentencia al Durable Object. */
export class RemoteSqlDatabase {
  constructor(private transport: SqlTransport) {}

  prepare(sql: string): RemoteStatement {
    return new RemoteStatement(this.transport, sql)
  }

  async exec(script: string): Promise<void> {
    const res = await this.transport({ sql: script, params: [], mode: "exec" })
    if (!res.ok) throw new Error(res.error)
  }
}

/** Transporte sobre un namespace de Durable Objects (producción). */
export function doTransport(ns: DurableObjectNamespace): SqlTransport {
  return async (payload) => {
    const id = ns.idFromName("primary")
    const stub = ns.get(id)
    const res = await stub.fetch("https://hub-db/sql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    return (await res.json()) as SqlRpcResult
  }
}

/** Transporte sobre HTTP directo (desarrollo local con `wrangler dev`). */
export function httpTransport(baseUrl: string): SqlTransport {
  return async (payload) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/sql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    return (await res.json()) as SqlRpcResult
  }
}

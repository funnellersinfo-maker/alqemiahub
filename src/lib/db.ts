// ============================================================
// ALQEMIA HUB — Cliente Prisma (multi-entorno)
//  · Cloudflare (producción): Durable Object SQLite vía
//    @prisma/adapter-d1 + RemoteSqlDatabase (véase cf-sql.ts)
//  · Local / sandbox: SQLite en archivo (comportamiento clásico)
// Se expone como Proxy perezoso: el cliente real se resuelve en el
// primer uso, dentro del contexto de una petición.
// ============================================================

import { PrismaClient } from "@prisma/client"
import { PrismaD1 } from "@prisma/adapter-d1"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { RemoteSqlDatabase, doTransport, httpTransport } from "@/lib/cf-sql"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __ALQEMIA_DB_PENDING__?: Promise<PrismaClient>
}

interface CfEnvLike {
  HUB_DB?: DurableObjectNamespace
  DB_API_URL?: string
}

/** Entorno de Cloudflare dentro de una petición (o null si no aplica). */
function resolveCloudflareEnv(): CfEnvLike | null {
  const manual = (globalThis as unknown as { __ALQEMIA_CF_ENV__?: CfEnvLike }).__ALQEMIA_CF_ENV__
  if (manual) return manual
  try {
    const ctx = getCloudflareContext() as { env: unknown } | null
    if (ctx?.env) return ctx.env as CfEnvLike
  } catch {
    // Sin contexto de Cloudflare (build / sandbox) → null
  }
  return null
}

function createRemoteClient(): PrismaClient {
  const env = resolveCloudflareEnv()
  if (env?.HUB_DB) {
    const remote = new RemoteSqlDatabase(doTransport(env.HUB_DB))
    return new PrismaClient({ adapter: new PrismaD1(remote as never), log: ["error", "warn"] })
  }
  if (env?.DB_API_URL) {
    const remote = new RemoteSqlDatabase(httpTransport(env.DB_API_URL))
    return new PrismaClient({ adapter: new PrismaD1(remote as never), log: ["error", "warn"] })
  }
  throw new Error("no-cloudflare-env")
}

function getClientPromise(): Promise<PrismaClient> {
  if (!globalForPrisma.__ALQEMIA_DB_PENDING__) {
    globalForPrisma.__ALQEMIA_DB_PENDING__ = Promise.resolve()
      .then(() => {
        globalForPrisma.prisma = createRemoteClient()
        return globalForPrisma.prisma
      })
      .catch(() => {
        // Fallback: SQLite local (sandbox / desarrollo / build)
        globalForPrisma.prisma = new PrismaClient({ log: ["error", "warn"] })
        return globalForPrisma.prisma
      })
  }
  return globalForPrisma.__ALQEMIA_DB_PENDING__
}

/** Proxy diferible: representa `client[prop]` antes de que el cliente exista. */
function lazyMember(prop: string | symbol): unknown {
  const t = function lazyTarget() {} as unknown as Record<string | symbol, unknown>
  return new Proxy(t, {
    get(_, sub) {
      return (...args: unknown[]) =>
        getClientPromise().then((client) => {
          const holder = client as unknown as Record<string | symbol, Record<string | symbol, unknown>>
          const member = holder[prop]
          const value = member?.[sub]
          if (typeof value === "function") {
            return (value as (...a: unknown[]) => unknown).apply(member, args)
          }
          return value
        })
    },
    apply(_, _thisArg, args) {
      return getClientPromise().then((client) => {
        const holder = client as unknown as Record<string | symbol, (...a: unknown[]) => unknown>
        const value = holder[prop]
        if (typeof value === "function") return value(...args)
        return value
      })
    },
  })
}

/** `db` se comporta como PrismaClient en cualquier entorno. */
export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const cached = globalForPrisma.prisma as unknown as Record<string | symbol, unknown> | undefined
    if (cached) {
      const value = cached[prop]
      return typeof value === "function"
        ? (value as (...a: unknown[]) => unknown).bind(cached)
        : value
    }
    return lazyMember(prop)
  },
})

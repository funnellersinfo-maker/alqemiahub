// ============================================================
// ALQEMIA HUB — NextAuth
// Credenciales (email/contraseña) + OAuth real:
//   · Google     (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
//   · Microsoft  (AZURE_CLIENT_ID / AZURE_CLIENT_SECRET)
//   · Apple      (APPLE_CLIENT_ID / APPLE_CLIENT_SECRET /
//                 APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY)
// Los proveedores aparecen automáticamente al definir sus
// variables; el primer login social crea la cuenta del miembro.
// ============================================================

import { getServerSession, NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AzureADProvider from "next-auth/providers/azure-ad"
import AppleProvider from "next-auth/providers/apple"
import type { Account, User as NextAuthUser } from "next-auth"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/password"

type SessionUserShape = {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  status: string
  profileCompleted: boolean
}

function toSessionUser(user: {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  status: string
  profileCompleted: boolean
}): SessionUserShape {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    status: user.status,
    profileCompleted: user.profileCompleted,
  }
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "ALQEMIA",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Contraseña", type: "password" },
      mode: { label: "Modo", type: "text" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase().trim()
      if (!email) return null
      const user = await db.user.findUnique({ where: { email } })
      if (!user || user.status === "BLOCKED") return null

      if (!user.passwordHash || !credentials?.password) return null
      if (!verifyPassword(credentials.password, user.passwordHash)) return null
      return toSessionUser(user)
    },
  }),
]

// ---- OAuth real: cada proveedor se activa con sus variables ----

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  )
}

if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
  providers.unshift(
    AzureADProvider({
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      // "common" admite cuentas personales (outlook/hotmail/live) y de trabajo
      tenantId: process.env.AZURE_TENANT_ID ?? "common",
      allowDangerousEmailAccountLinking: true,
    })
  )
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.unshift(
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      // JWT de cliente generado desde la clave .p8 (Apple lo exige; vence cada ~6 meses)
      clientSecret: process.env.APPLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  )
}

/** Primer login social → crea la cuenta del miembro (sin contraseña). */
async function upsertOAuthUser(authUser: NextAuthUser, account: Account): Promise<boolean> {
  const email = authUser.email?.toLowerCase().trim()
  if (!email) return false

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    // Miembros suspendidos no pueden volver a ingresar
    if (existing.status === "BLOCKED") return false
    return true
  }

  const name = (authUser.name ?? email.split("@")[0] ?? "Miembro ALQEMIA").trim() || "Miembro ALQEMIA"
  await db.user.create({
    data: {
      name: name.slice(0, 60),
      email,
      image: authUser.image ? String(authUser.image).slice(0, 250_000) : null,
      googleId: account.provider === "google" ? account.providerAccountId : null,
    },
  })
  return true
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  secret: process.env.NEXTAUTH_SECRET ?? "alqemia-hub-dev-secret",
  callbacks: {
    async signIn({ user, account }) {
      if (account?.type === "oauth") {
        return upsertOAuthUser(user, account)
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        // Credenciales: `user` ya es nuestra forma con id de la BD.
        // OAuth: `user.id` es el id del proveedor → resolvemos por email.
        const email = user.email?.toLowerCase().trim()
        const dbUser = email ? await db.user.findUnique({ where: { email } }) : null
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.status = dbUser.status
          token.profileCompleted = dbUser.profileCompleted
        } else if (user.id) {
          token.id = user.id
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? ""
        session.user.role = (token.role as string) ?? "USER"
        session.user.status = (token.status as string) ?? "ACTIVE"
        session.user.profileCompleted = (token.profileCompleted as boolean) ?? false
      }
      return session
    },
  },
}

export function auth() {
  return getServerSession(authOptions)
}

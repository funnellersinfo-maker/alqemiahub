// ============================================================
// ALQEMIA HUB — NextAuth (credenciales + Google OAuth opcional)
// ============================================================

import { getServerSession, NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
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

// Google OAuth real — se activa automáticamente cuando existen las variables
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  secret: process.env.NEXTAUTH_SECRET ?? "alqemia-hub-dev-secret",
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.status = user.status
        token.profileCompleted = user.profileCompleted
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

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireUser, errorResponse, handleApiError } from "@/lib/api-helpers"
import { awardXpFor, ACHIEVEMENTS, getLevelInfo } from "@/lib/gamification"
import type { MeUser, XpEvent } from "@/lib/types"

async function buildMeUser(userId: string): Promise<MeUser> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { achievements: { orderBy: { createdAt: "asc" } } },
  })
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    avatarColor: user.avatarColor,
    headline: user.headline,
    bio: user.bio,
    goal: user.goal,
    xp: user.xp,
    status: user.status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
    profileCompleted: user.profileCompleted,
    createdAt: user.createdAt.toISOString(),
    level: getLevelInfo(user.xp),
    achievements: user.achievements.map((a) => ({
      code: a.code,
      label: ACHIEVEMENTS[a.code]?.label ?? a.code,
      icon: ACHIEVEMENTS[a.code]?.icon ?? "Award",
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

export async function GET() {
  try {
    const user = await requireUser()
    // Registrar actividad (métricas admin de usuarios activos)
    await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
    const me = await buildMeUser(user.id)
    return Response.json({ user: me })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json().catch(() => ({}))

    const data: Record<string, string | boolean> = {}

    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (name.length < 2 || name.length > 60) return errorResponse(400, "El nombre debe tener entre 2 y 60 caracteres")
      data.name = name
    }
    if (typeof body.headline === "string") {
      if (body.headline.length > 120) return errorResponse(400, "El titular es demasiado largo")
      data.headline = body.headline.trim() || ""
    }
    if (typeof body.bio === "string") {
      if (body.bio.length > 500) return errorResponse(400, "La bio es demasiado larga")
      data.bio = body.bio.trim()
    }
    if (typeof body.goal === "string") {
      if (body.goal.length > 160) return errorResponse(400, "El objetivo es demasiado largo")
      data.goal = body.goal.trim()
    }
    if (typeof body.avatarColor === "string") {
      if (!/^#[0-9a-fA-F]{6}$/.test(body.avatarColor)) return errorResponse(400, "Color de avatar inválido")
      data.avatarColor = body.avatarColor
    }
    if (typeof body.image === "string") {
      if (!body.image.startsWith("data:image/")) return errorResponse(400, "Formato de imagen inválido")
      if (body.image.length > 250_000) return errorResponse(400, "La imagen es demasiado grande (máx ~250KB)")
      data.image = body.image
    }

    let xpEvent: XpEvent | null = null
    if (body.profileCompleted === true && !user.profileCompleted) {
      data.profileCompleted = true
    }

    if (Object.keys(data).length > 0) {
      await db.user.update({ where: { id: user.id }, data })
    }
    if (data.profileCompleted === true) {
      xpEvent = await awardXpFor(user.id, "profile")
    }

    const me = await buildMeUser(user.id)
    return Response.json({ user: me, xp: xpEvent })
  } catch (e) {
    return handleApiError(e)
  }
}

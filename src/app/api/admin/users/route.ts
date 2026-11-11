// GET / PATCH / DELETE /api/admin/users — Listar, bloquear/activar y eliminar
// miembros (header x-admin-key o sesión con rol ADMIN)
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { authOptions } from "@/lib/auth"
import { errorResponse, handleApiError } from "@/lib/api-helpers"
import { getLevelInfo } from "@/lib/gamification"
import type { AdminUserRow } from "@/lib/types"

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")

    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase()

    const users = await db.user.findMany({
      include: {
        _count: { select: { posts: true, comments: true, progress: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const filtered = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        )
      : users

    const rows: AdminUserRow[] = filtered.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      avatarColor: u.avatarColor,
      role: u.role === "ADMIN" ? "ADMIN" : "USER",
      status: u.status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
      xp: u.xp,
      level: getLevelInfo(u.xp),
      postCount: u._count.posts,
      commentCount: u._count.comments,
      lessonsCompleted: u._count.progress,
      createdAt: u.createdAt.toISOString(),
      lastActiveAt: u.lastActiveAt.toISOString(),
    }))

    return Response.json({ users: rows })
  } catch (e) {
    return handleApiError(e)
  }
}

/** DELETE — Elimina un miembro y todo su contenido (cascada).
 * Protegido: no se puede eliminar la propia cuenta ni cuentas ADMIN. */
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const userId = typeof body.userId === "string" ? body.userId : ""
    if (!userId) return errorResponse(400, "Miembro inválido")

    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) return errorResponse(404, "Miembro no encontrado")

    // Blindaje: las cuentas ADMIN (la del titular) no se pueden borrar desde aquí
    if (target.role === "ADMIN") {
      return errorResponse(403, "No se puede eliminar una cuenta de administrador")
    }

    // Si la petición viene de una sesión, impedir el auto-borrado
    const session = await getServerSession(authOptions)
    if (session?.user?.id && session.user.id === userId) {
      return errorResponse(403, "No puedes eliminar tu propia cuenta")
    }

    await db.user.delete({ where: { id: userId } })

    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return errorResponse(401, "No autorizado")

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const userId = typeof body.userId === "string" ? body.userId : ""
    const status = typeof body.status === "string" ? body.status : ""

    if (!userId || (status !== "ACTIVE" && status !== "BLOCKED")) {
      return errorResponse(400, "Estado inválido")
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return errorResponse(404, "Miembro no encontrado")

    await db.user.update({ where: { id: userId }, data: { status } })

    return Response.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

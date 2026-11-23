// ============================================================
// /api/admin/purge — LA GRAN PURGA (solo titular).
// Limpia el hub de datos de demostración:
//   · Elimina TODOS los miembros salvo el titular (ADMIN) con
//     todo su contenido (posts, comentarios, likes, progreso…)
//   · Vacia el muro por completo (incluidas las publicaciones
//     del titular) para empezar de cero.
//   · Refuerza al titular: verificado, rango Gran Maestre.
// Devuelve un resumen de lo eliminado.
// ============================================================

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { isAdminRequest } from "@/lib/admin"
import { errorResponse, handleApiError, ApiError } from "@/lib/api-helpers"

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) throw new ApiError(401, "No autorizado")

    const admin = await db.user.findFirst({ where: { role: "ADMIN" } })
    if (!admin) return errorResponse(500, "No hay titular en el hub")

    // Conteos previos para el resumen
    const [usersBefore, postsBefore] = await Promise.all([
      db.user.count(),
      db.post.count(),
    ])

    // 1) Miembros no-admin: su contenido se elimina en cascada
    //    (posts, comentarios, likes, progreso, logros, productos,
    //    ventas, favoritos, conversaciones y códigos)
    const deletedUsers = await db.user.deleteMany({ where: { role: { not: "ADMIN" } } })

    // 2) Muro limpio: también las publicaciones del titular
    const deletedPosts = await db.post.deleteMany({})

    // 3) Restos huérfanos posibles (comentarios/likes sin post)
    await db.comment.deleteMany({})
    await db.like.deleteMany({})

    // 4) El titular queda sellado: verificado, Gran Maestre (XP de
    //    exhibición es INFINITUM, pero el rango real también se
    //    refuerza por si acaso) y activo.
    await db.user.update({
      where: { id: admin.id },
      data: {
        verified: true,
        status: "ACTIVE",
        xp: Math.max(admin.xp, 3600), // rango Leyenda real; en pantalla: INFINITUM
      },
    })

    return Response.json({
      ok: true,
      summary: {
        membersBefore: usersBefore,
        membersRemoved: deletedUsers.count,
        postsBefore,
        postsRemoved: deletedPosts.count,
      },
    })
  } catch (e) {
    return handleApiError(e)
  }
}

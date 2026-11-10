// Prueba E2E del stack Prisma → adapter-d1 → shim → Durable Object
// Ejecutar desde la copia de deploy con el db-worker local en 8787
;(globalThis as unknown as { __ALQEMIA_CF_ENV__?: unknown }).__ALQEMIA_CF_ENV__ = {
  DB_API_URL: "http://localhost:8787",
}

async function main() {
  const { db } = await import("../src/lib/db")

  // 1) Login: findUnique
  const user = await db.user.findUnique({ where: { email: "valeria@alqemia.com" } })
  if (!user) throw new Error("FALLO findUnique (login)")
  console.log("✓ findUnique (login):", user.name, "| role:", user.role)

  // 2) Feed: findMany con include + orderBy + take
  const posts = await db.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      user: { select: { id: true, name: true, avatarColor: true, image: true } },
      comments: { include: { user: { select: { name: true } } } },
      likes: { include: { user: { select: { name: true } } } },
    },
  })
  if (posts.length === 0) throw new Error("FALLO feed findMany")
  console.log("✓ feed findMany + includes:", posts.length, "posts; el primero de", posts[0].user.name, "con", posts[0].comments.length, "comentarios y", posts[0].likes.length, "likes")

  // 3) Leaderboard: orderBy xp take
  const top = await db.user.findMany({ orderBy: { xp: "desc" }, take: 3 })
  console.log("✓ leaderboard:", top.map((u) => u.name).join(" | "))

  // 4) Update (lastActiveAt del /api/me)
  await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
  console.log("✓ update lastActiveAt")

  // 5) Registro: create (fecha automática, role default)
  const created = await db.user.create({
    data: { name: "Prueba Shim", email: `shim-${Date.now()}@test.com`, passwordHash: "scrypt:x:y" },
  })
  console.log("✓ create (registro):", created.id.slice(0, 8), "| role:", created.role, "| createdAt:", created.createdAt.toISOString())

  // 6) Unique violation → debe lanzar P2002
  let p2002 = false
  try {
    await db.user.create({
      data: { name: "Duplicado", email: created.email, passwordHash: "x" },
    })
  } catch (e) {
    p2002 = (e as { code?: string }).code === "P2002"
  }
  console.log("✓ unique violation → P2002:", p2002)

  // 7) Cursos con lecciones (include anidado)
  const courses = await db.course.findMany({
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  })
  console.log("✓ cursos:", courses.length, "programas;", courses.reduce((n, c) => n + c.lessons.length, 0), "lecciones")

  // 8) Logros del usuario (include, used by /api/me)
  const withAch = await db.user.findUnique({
    where: { email: "valeria@alqemia.com" },
    include: { achievements: { orderBy: { createdAt: "asc" } } },
  })
  console.log("✓ achievements include:", withAch?.achievements.length, "logros")

  // 9) count + deleteMany (admin stats / limpieza)
  const count = await db.user.count()
  await db.user.deleteMany({ where: { email: created.email } })
  const after = await db.user.count()
  console.log("✓ count:", count, "→ tras delete:", after)

  console.log("\nTODAS LAS PRUEBAS DEL SHIM PASARON")
}

main().catch((e) => {
  console.error("ERROR EN PRUEBA:", e)
  process.exit(1)
})

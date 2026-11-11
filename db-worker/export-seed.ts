// Exporta la BD local del sandbox a db-worker/seed.sql
// (INSERTs con el formato exacto que Prisma usa en SQLite:
//  fechas ISO-8601 con +00:00, booleanos 0/1, ids explícitos)
import { PrismaClient } from "@prisma/client"
import { writeFileSync } from "fs"

const db = new PrismaClient()

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "number" || typeof v === "bigint") return String(v)
  if (typeof v === "boolean") return v ? "1" : "0"
  if (v instanceof Date) return `'${v.toISOString().replace("Z", "+00:00")}'`
  const s = String(v)
  return `'${s.replace(/'/g, "''")}'`
}

function inserts(table: string, columns: string[], rows: unknown[][]): string {
  if (rows.length === 0) return `-- ${table}: sin filas\n`
  const lines = rows.map(
    (r) => `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${r
      .map(esc)
      .join(", ")});`
  )
  return `-- ${table} (${rows.length})\n${lines.join("\n")}\n`
}

async function main() {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } })
  const courses = await db.course.findMany({ orderBy: { order: "asc" } })
  const lessons = await db.lesson.findMany({ orderBy: [{ courseId: "asc" }, { order: "asc" }] })
  const posts = await db.post.findMany({ orderBy: { createdAt: "asc" } })
  const comments = await db.comment.findMany({ orderBy: { createdAt: "asc" } })
  const likes = await db.like.findMany({ orderBy: { createdAt: "asc" } })
  const achievements = await db.achievement.findMany({ orderBy: { createdAt: "asc" } })
  const progress = await db.lessonProgress.findMany({ orderBy: { completedAt: "asc" } })

  const out = [
    "-- ==========================================================",
    "-- ALQEMIA HUB — Datos iniciales (seed) para el Durable Object",
    "-- Generado automáticamente desde la BD local del sandbox",
    "-- ==========================================================",
    "PRAGMA defer_foreign_keys = TRUE;",
    inserts(
      "User",
      ["id", "name", "email", "passwordHash", "googleId", "image", "avatarColor", "role", "status", "headline", "bio", "goal", "profileCompleted", "xp", "lastActiveAt", "createdAt", "updatedAt"],
      users.map((u) => [u.id, u.name, u.email, u.passwordHash, u.googleId, u.image, u.avatarColor, u.role, u.status, u.headline, u.bio, u.goal, u.profileCompleted, u.xp, u.lastActiveAt, u.createdAt, u.updatedAt])
    ),
    inserts(
      "Course",
      ["id", "slug", "title", "description", "level", "cover", "order", "createdAt"],
      courses.map((c) => [c.id, c.slug, c.title, c.description, c.level, c.cover, c.order, c.createdAt])
    ),
    inserts(
      "Lesson",
      ["id", "courseId", "title", "description", "videoUrl", "durationMin", "order"],
      lessons.map((l) => [l.id, l.courseId, l.title, l.description, l.videoUrl, l.durationMin, l.order])
    ),
    inserts(
      "Post",
      ["id", "userId", "content", "image", "createdAt", "updatedAt"],
      posts.map((p) => [p.id, p.userId, p.content, p.image, p.createdAt, p.updatedAt])
    ),
    inserts(
      "Comment",
      ["id", "postId", "userId", "content", "createdAt"],
      comments.map((c) => [c.id, c.postId, c.userId, c.content, c.createdAt])
    ),
    inserts(
      "Like",
      ["id", "postId", "userId", "createdAt"],
      likes.map((l) => [l.id, l.postId, l.userId, l.createdAt])
    ),
    inserts(
      "Achievement",
      ["id", "userId", "code", "createdAt"],
      achievements.map((a) => [a.id, a.userId, a.code, a.createdAt])
    ),
    inserts(
      "LessonProgress",
      ["id", "userId", "lessonId", "completedAt"],
      progress.map((p) => [p.id, p.userId, p.lessonId, p.completedAt])
    ),
  ].join("\n")

  writeFileSync(new URL("./seed.sql", import.meta.url).pathname, out)
  console.log(
    `seed.sql generado: ${users.length} usuarios, ${courses.length} cursos, ${lessons.length} lecciones, ${posts.length} posts, ${comments.length} comentarios, ${likes.length} likes, ${achievements.length} logros, ${progress.length} progresos`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

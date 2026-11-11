// ============================================================
// ALQEMIA HUB — Seed de la base de datos
// Ejecutar con: bun prisma/seed.ts
// ============================================================

import { PrismaClient } from "@prisma/client"
import crypto from "crypto"

const db = new PrismaClient()

const VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
]

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `scrypt:${salt}:${hash}`
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000)
}
function daysAgo(d: number, extraH = 0): Date {
  return new Date(Date.now() - d * 24 * 3600_000 - extraH * 3600_000)
}

// Contraseña del titular del Hub (cuenta ADMIN). Cámbiala desde el panel
// si compartes este repositorio.
const ADMIN_EMAIL = "admin@alqemia.com"
const ADMIN_PASSWORD = "AlqemiaAdmin2025!"

// Los perfiles de contenido inicial usan contraseñas aleatorias: son perfiles
// de arranque de la comunidad, no cuentas de acceso.
function randomPasswordHash(): string {
  return hashPassword(crypto.randomBytes(24).toString("hex"))
}

// Emails que pertenecen al seed: solo estos se borran y recrean.
// Las cuentas reales creadas por usuarios (registro/Google) se preservan.
const SEED_EMAILS = [
  "admin@alqemia.com",
  "valeria@alqemia.com",
  "diego@alqemia.com",
  "camila@alqemia.com",
  "sebastian@alqemia.com",
  "lucia@alqemia.com",
  "mateo@alqemia.com",
  "sofia@alqemia.com",
  "daniel@alqemia.com",
  "isabela@alqemia.com",
  "tomas@alqemia.com",
  "carlos@alqemia.com",
]

async function main() {
  console.log("Limpiando datos del seed previo (se preservan las cuentas reales)...")
  await db.like.deleteMany({
    where: { OR: [{ user: { email: { in: SEED_EMAILS } } }, { post: { user: { email: { in: SEED_EMAILS } } } }] },
  })
  await db.comment.deleteMany({
    where: { OR: [{ user: { email: { in: SEED_EMAILS } } }, { post: { user: { email: { in: SEED_EMAILS } } } }] },
  })
  await db.post.deleteMany({ where: { user: { email: { in: SEED_EMAILS } } } })
  await db.user.deleteMany({ where: { email: { in: SEED_EMAILS } } })
  await db.lesson.deleteMany()
  await db.course.deleteMany()

  const realUsers = await db.user.count()
  console.log(`Cuentas reales preservadas: ${realUsers}`)

  console.log("Creando programas de formación...")
  type CourseSeed = {
    slug: string
    title: string
    description: string
    level: string
    cover: string
    order: number
    lessons: [string, string, number][]
  }
  const courseData: CourseSeed[] = [
    {
      slug: "ecommerce-desde-cero",
      title: "Ecommerce desde Cero",
      description:
        "Monta tu primera tienda online con fundamentos sólidos: producto, validación, conversión, pagos y lanzamiento.",
      level: "Principiante",
      cover: "/images/courses/ecommerce.png",
      order: 1,
      lessons: [
        ["Bienvenida y mapa del programa", "Cómo funciona ALQEMIA y cómo sacarle el máximo provecho a este programa.", 8],
        ["Elegir tu producto y validar demanda", "Método simple para elegir un producto que la gente ya está comprando.", 14],
        ["Montar tu tienda: fundamentos de conversión", "Estructura, fichas y velocidad: todo lo que debe estar perfecto antes de pagar tráfico.", 16],
        ["Pasarelas de pago y logística básica", "Cómo cobrar sin dolores de cabeza y entregar a tiempo.", 12],
        ["Tu primera campaña de lanzamiento", "El plan de 7 días para tus primeras ventas reales.", 18],
      ],
    },
    {
      slug: "master-meta-ads",
      title: "Máster en Meta Ads",
      description:
        "De la estructura de campañas al escalado: el sistema completo para vender con anuncios de Meta sin quemar presupuesto.",
      level: "Intermedio",
      cover: "/images/courses/meta-ads.png",
      order: 2,
      lessons: [
        ["Estructura de campañas que venden", "El pilar de todo: campañas, conjuntos y anuncios correctamente configurados.", 15],
        ["Investigación de audiencias", "Cómo encontrar a tu comprador ideal antes de gastar en creatividades.", 12],
        ["Creatividades que detienen el scroll", "Anatomía de un anuncio ganador y cómo producirlo rápido.", 14],
        ["Escalado vertical vs horizontal", "Cuándo subir presupuesto y cuándo duplicar: la decisión de las 7 cifras.", 17],
        ["Métricas: qué mirar y qué ignorar", "CPM, CTR, CPA, ROAS: el tablero mínimo para decidir con datos.", 13],
      ],
    },
    {
      slug: "copywriting-persuasivo",
      title: "Copywriting Persuasivo",
      description:
        "Textos que venden: psicología del comprador, frameworks probados y copy para fichas, emails y anuncios.",
      level: "Principiante",
      cover: "/images/courses/copywriting.png",
      order: 3,
      lessons: [
        ["Psicología del comprador", "Las 5 motivaciones reales que mueven a comprar, sin humo.", 11],
        ["Frameworks de copy ganadores", "AIDA, PAS y FAB aplicados a productos reales.", 14],
        ["Copy para fichas de producto", "Beneficios antes que características: la fórmula de fichas que convierten.", 12],
        ["Emails que abren y compran", "Asuntos, cuerpo y llamadas a la acción que no dan vergüenza.", 13],
        ["Copy para ads de alto CTR", "Ganchos y ángulos para tus anuncios, listos para publicar.", 15],
      ],
    },
    {
      slug: "branding-personal",
      title: "Branding Personal",
      description:
        "Construye una marca personal que atrae clientes: posicionamiento, contenido de autoridad y captación.",
      level: "Intermedio",
      cover: "/images/courses/branding.png",
      order: 4,
      lessons: [
        ["Tu historia como activo", "Cómo convertir tu experiencia en posicionamiento creíble.", 10],
        ["Posicionamiento y nicho", "El ejercicio de una frase para definir a quién sirves y en qué.", 12],
        ["Contenido que construye autoridad", "El sistema de 90 días para volverte referente en tu tema.", 14],
        ["Ofertas de servicios personales", "Cómo empaquetar tus habilidades en una oferta clara y rentable.", 15],
        ["Sistema de captación de clientes", "La máquina simple: contenido, conversación, cierre.", 16],
      ],
    },
    {
      slug: "marketing-de-contenidos",
      title: "Marketing de Contenidos",
      description:
        "El sistema de contenido de ALQEMIA: 90 días de plan, reels con guion y analítica para crecer con constancia.",
      level: "Principiante",
      cover: "/images/courses/contenidos.png",
      order: 5,
      lessons: [
        ["Estrategia de contenido 90 días", "Cómo planificar un trimestre sin quedarte sin ideas.", 13],
        ["Reels: guion, gancho y retención", "La estructura de 3 segundos, 3 líneas y 3 clics.", 15],
        ["Del alcance a la conversión", "Cómo pasar de vistas a ventas sin parecer vendedor.", 12],
        ["Calendario y batching", "Produce un mes de contenido en una tarde.", 11],
        ["Analítica de contenidos", "Las 4 métricas que importan y las que solo presumen.", 13],
      ],
    },
    {
      slug: "escalado-a-7-cifras",
      title: "Escalado a 7 Cifras",
      description:
        "Para tiendas que ya venden: sistemas, finanzas, operaciones y equipo para escalar sin que todo dependa de ti.",
      level: "Avanzado",
      cover: "/images/courses/escalado.png",
      order: 6,
      lessons: [
        ["Sistemas y equipos: salir del operador", "Primer contratación, procesos y delegación real.", 18],
        ["Estructura financiera del ecommerce", "Margen, caja y reinversión: los números que sostienen el escalamiento.", 17],
        ["Operaciones y stock a escala", "Inventario, proveedores y tiempos sin romper la promesa.", 16],
        ["Fidelización y LTV", "Venderle de nuevo a quien ya te compró: el activo olvidado.", 15],
        ["Plan de crecimiento", "Tu roadmap de 12 meses hacia la siguiente cifra.", 20],
      ],
    },
  ]

  const courseIds: Record<string, string> = {}
  const lessonIds: Record<string, string[]> = {}
  for (const c of courseData) {
    const course = await db.course.create({
      data: {
        slug: c.slug,
        title: c.title,
        description: c.description,
        level: c.level,
        cover: c.cover,
        order: c.order,
      },
    })
    courseIds[c.slug] = course.id
    lessonIds[c.slug] = []
    for (let i = 0; i < c.lessons.length; i++) {
      const [title, description, durationMin] = c.lessons[i]
      const lesson = await db.lesson.create({
        data: {
          courseId: course.id,
          title,
          description,
          durationMin,
          order: i + 1,
          videoUrl: VIDEOS[i % VIDEOS.length],
        },
      })
      lessonIds[c.slug].push(lesson.id)
    }
  }
  console.log(`Creados ${courseData.length} programas con sus lecciones`)

  console.log("Creando miembros...")
  const users = [
    { name: "Admin ALQEMIA", email: "admin@alqemia.com", headline: "Equipo ALQEMIA", avatarColor: "#d4af37", xp: 2400, bio: "Cuenta oficial del equipo ALQEMIA. Gestiono la comunidad, el contenido y las métricas del Hub.", goal: "Hacer crecer la comunidad", experience: "scaling", createdAt: daysAgo(30, 0), lastActiveAt: hoursAgo(0), role: "ADMIN" },
    { name: "Valeria Ríos", email: "valeria@alqemia.com", headline: "Ecommerce · Moda", avatarColor: "#d97706", xp: 1240, bio: "Fundé mi marca de moda hace 2 años. Aquí estoy para escalar con sistemas y sin improvisar.", goal: "Llevar mi tienda a 7 cifras", experience: "scaling", createdAt: daysAgo(13, 5), lastActiveAt: hoursAgo(1) },
    { name: "Diego Márquez", email: "diego@alqemia.com", headline: "Tráfico · Meta Ads", avatarColor: "#059669", xp: 2110, bio: "Especialista en tráfico. Ayudo a tiendas a escalar con creatividades que funcionan.", goal: "Armar mi agencia de tráfico", experience: "scaling", createdAt: daysAgo(12, 2), lastActiveAt: hoursAgo(3) },
    { name: "Camila Torres", email: "camila@alqemia.com", headline: "Marketing de contenidos", avatarColor: "#e11d48", xp: 660, bio: "Creo contenido para marcas de belleza. En camino de convertir mi perfil en un negocio.", goal: "Duplicar mi comunidad en 90 días", experience: "growing", createdAt: daysAgo(11, 8), lastActiveAt: hoursAgo(6) },
    { name: "Sebastián Vega", email: "sebastian@alqemia.com", headline: "Ecommerce · Dropsi", avatarColor: "#0d9488", xp: 340, bio: "Primera tienda en marcha. Documento todo el proceso, incluidos los fracasos.", goal: "Hacer mi primera venta", experience: "starter", createdAt: daysAgo(10, 1), lastActiveAt: hoursAgo(12) },
    { name: "Lucía Fernández", email: "lucia@alqemia.com", headline: "Copywriting", avatarColor: "#ea580c", xp: 980, bio: "Copywriter freelance. Obsesionada con emails que la gente de verdad abre.", goal: "Llenar mi agenda de clientes", experience: "growing", createdAt: daysAgo(9, 3), lastActiveAt: hoursAgo(20) },
    { name: "Mateo Rodríguez", email: "mateo@alqemia.com", headline: "Branding personal", avatarColor: "#65a30d", xp: 180, bio: "Vengo del mundo corporativo y estoy construyendo mi marca como consultor.", goal: "Conseguir 3 clientes de branding", experience: "starter", createdAt: daysAgo(7, 6), lastActiveAt: hoursAgo(30) },
    { name: "Sofía Herrera", email: "sofia@alqemia.com", headline: "Ecommerce · Belleza", avatarColor: "#c026d3", xp: 1720, bio: "Tienda de skincare. Debilidad por los números y el margen antes que por la vanidad.", goal: "Escalar a 100 órdenes diarias", experience: "scaling", createdAt: daysAgo(6, 4), lastActiveAt: hoursAgo(2) },
    { name: "Daniel Ortiz", email: "daniel@alqemia.com", headline: "Afiliación digital", avatarColor: "#a8a29e", xp: 520, bio: "Aprendiendo el modelo de afiliados con contenido orgánico. Cero presupuesto.", goal: "Mi primera comisión recurrente", experience: "starter", createdAt: daysAgo(5, 9), lastActiveAt: hoursAgo(40) },
    { name: "Isabela Moreno", email: "isabela@alqemia.com", headline: "Emprendedora digital", avatarColor: "#059669", xp: 110, bio: "Empezando desde cero. Vengo del mundo tradicional y quiero mi primer negocio online.", goal: "Aprender lo básico y lanzar", experience: "starter", createdAt: daysAgo(2, 2), lastActiveAt: hoursAgo(8) },
    { name: "Tomás Caballero", email: "tomas@alqemia.com", headline: "Restaurante → Digital", avatarColor: "#d97706", xp: 280, bio: "Dueño de restaurante digitalizando el negocio. Pide delivery el que esté cerca.", goal: "Digitalizar mi restaurante", experience: "growing", createdAt: daysAgo(4, 7), lastActiveAt: hoursAgo(26) },
    { name: "Carlos Espinoza", email: "carlos@alqemia.com", headline: "Marketing digital", avatarColor: "#e11d48", xp: 300, bio: "", goal: "", experience: "starter", createdAt: daysAgo(3, 1), lastActiveAt: daysAgo(1, 6), status: "BLOCKED" },
  ]

  const userIds: Record<string, string> = {}
  for (const u of users) {
    const user = await db.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash: u.email === ADMIN_EMAIL ? hashPassword(ADMIN_PASSWORD) : randomPasswordHash(),
        avatarColor: u.avatarColor,
        headline: u.headline,
        bio: u.bio || null,
        goal: u.goal || null,
        experience: u.experience ?? null,
        xp: u.xp,
        profileCompleted: true,
        status: u.status ?? "ACTIVE",
        role: u.role ?? "USER",
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
      },
    })
    userIds[u.email] = user.id
  }
  console.log(`Creados ${users.length} miembros`)

  console.log("Creando publicaciones del muro...")
  type SeedPost = { author: string; content: string; hours: number }
  const posts: SeedPost[] = [
    {
      author: "valeria@alqemia.com",
      content:
        "Checkpoint de la semana: cerramos la mejor semana desde que lancé la tienda. 32 órdenes y un ROAS de 3.4. La lección que me lo cambió todo fue la de escalado del Máster en Meta Ads: no toques la creativa ganadora hasta pasar las 50 conversiones. Si están en campaña, eso evita muchos dolores de cabeza.",
      hours: 3,
    },
    {
      author: "diego@alqemia.com",
      content:
        "Pregunta para los que ya escalan: en qué momento decidieron duplicar presupuesto? Llevo 3 días con un CPA estable de $4.20 y tengo miedo de romper la magia. Aportes bienvenidos, prometo devolver el favor con lo que aprenda del experimento.",
      hours: 7,
    },
    {
      author: "camila@alqemia.com",
      content:
        "Terminé el programa de Marketing de Contenidos en una semana. Cinco lecciones que valen oro. Mi takeaway: constancia antes que perfección. Este mes publiqué 22 reels y dupliqué alcance sin gastar un peso en ads. Gracias ALQEMIA por un sistema tan claro.",
      hours: 14,
    },
    {
      author: "sofia@alqemia.com",
      content:
        "Herramienta del día: usé la Calculadora de Precios antes de lanzar mi nueva línea de serums y descubrí que estaba dejando 23% de margen sobre la mesa. Si venden producto físico, no lancen nada sin calcular bien envío y comisión de pasarela. Los números primero, la emoción después.",
      hours: 22,
    },
    {
      author: "lucia@alqemia.com",
      content:
        "Les comparto un mini marco de copy que me está funcionando en emails: 1) dolor real, 2) promesa concreta, 3) prueba, 4) una sola llamada a la acción. Mi último email abrió al 41%. El CopyLab IA me ayuda a generar variantes en segundos y después las pulo a mano. Aliado silencioso.",
      hours: 30,
    },
    {
      author: "sebastian@alqemia.com",
      content:
        "Día 12 probando el producto que elegí para mi dropsi. Primera venta a las 6:40 de la mañana. Una sola. Y la celebré como si fueran mil. Así se empieza, ¿verdad? Alguien más en etapa de validación para compartir números sin filtros?",
      hours: 44,
    },
    {
      author: "mateo@alqemia.com",
      content:
        "Mi compromiso del trimestre, por escrito y frente a testigos: 10.000 seguidores y 3 clientes de branding. Voy a publicar mi avance cada lunes en este muro para no perderme. Quien quiera, me acompaña y me exige cuando toque.",
      hours: 51,
    },
    {
      author: "tomas@alqemia.com",
      content:
        "Vengo del mundo físico, tengo un restaurante, y entré al hub para digitalizar el negocio. La primera lección de Ecommerce desde Cero me despejó dudas que arrastraba hace meses. Alguien más dando el salto de lo tradicional a lo digital?",
      hours: 62,
    },
    {
      author: "isabela@alqemia.com",
      content:
        "Me acabo de crear la cuenta y completé mi perfil. Qué emoción empezar de cero con ustedes. Recomendación: por dónde empiezo, primero el programa de ecommerce o mejor el de contenidos? Mi objetivo es entender el mapa completo antes de elegir.",
      hours: 73,
    },
    {
      author: "daniel@alqemia.com",
      content:
        "Primera comisión de afiliado: $47 dólares. Para muchos es poco; para mí es la prueba de que el modelo funciona. El orgullo no me deja dormir. La racha sigue, siguiente meta: la primera comisión recurrente de la semana.",
      hours: 85,
    },
    {
      author: "valeria@alqemia.com",
      content:
        "Pregunta rápida para los que venden en Latam: qué pasarela están usando? Estoy evaluando cambiar porque los retrasos de liquidación me complican el flujo de caja para comprar inventario. Experiencias reales, por favor.",
      hours: 100,
    },
    {
      author: "sofia@alqemia.com",
      content:
        "El programa de Escalado a 7 Cifras me voló la cabeza. Números reales, ejemplos reales, cero humo. Recomendado para cualquiera que ya venda y quiera montar sistemas en vez de vivir apagando incendios. Lo estoy viendo por segunda vez y tomando notas distintas.",
      hours: 120,
    },
  ]

  const postRecords: { id: string; authorEmail: string }[] = []
  for (const p of posts) {
    const post = await db.post.create({
      data: {
        userId: userIds[p.author],
        content: p.content,
        createdAt: hoursAgo(p.hours),
      },
    })
    postRecords.push({ id: post.id, authorEmail: p.author })
  }
  console.log(`Creadas ${posts.length} publicaciones`)

  console.log("Creando comentarios...")
  type SeedComment = { postIndex: number; author: string; content: string; hours: number }
  const comments: SeedComment[] = [
    { postIndex: 0, author: "diego@alqemia.com", content: "Apliqué esa regla y me salvó una campaña que llevaba $800. La regla de las 50 es sagrada.", hours: 2 },
    { postIndex: 0, author: "sofia@alqemia.com", content: "Ese ROAS con moda es para aplaudir. El margen de moda castiga, bien ahí.", hours: 1 },
    { postIndex: 0, author: "camila@alqemia.com", content: "Anotando la regla de las 50. Gracias por compartir el número real.", hours: 1 },
    { postIndex: 1, author: "sofia@alqemia.com", content: "Si llevas 3 días estable, sube 20% y espera 72 horas. Es lo que me funcionó con serums.", hours: 5 },
    { postIndex: 1, author: "valeria@alqemia.com", content: "El miedo a romperlo es real. Pero recuerda: si funciona, se puede reconstruir. Si nunca escalas, no hay nada que reconstruir.", hours: 4 },
    { postIndex: 2, author: "isabela@alqemia.com", content: "Tu post me acaba de decidir: empiezo por contenidos. Gracias por compartir tu resultado.", hours: 10 },
    { postIndex: 3, author: "sebastian@alqemia.com", content: "La calculadora me reveló lo mismo con envíos. Casi lanzo regalando dinero.", hours: 18 },
    { postIndex: 4, author: "mateo@alqemia.com", content: "El punto 4 es el más difícil: una sola CTA. En branding siempre quiero vender tres cosas a la vez.", hours: 25 },
    { postIndex: 5, author: "daniel@alqemia.com", content: "Así se empieza. Mi primera comisión también fue sola y fue la mejor notificación del año.", hours: 38 },
    { postIndex: 5, author: "tomas@alqemia.com", content: "Ánimo! Yo voy 14 días sin venta pero el punto es seguir probando. Nos vamos a comparar resultados.", hours: 36 },
    { postIndex: 6, author: "camila@alqemia.com", content: "Te exijo los lunes. Este muro será testigo.", hours: 45 },
    { postIndex: 8, author: "valeria@alqemia.com", content: "Bienvenida Isabela! Mi consejo: ecommerce primero si quieres vender producto, contenidos primero si quieres audiencia. Decide por el negocio, no por el gustito.", hours: 60 },
    { postIndex: 8, author: "camila@alqemia.com", content: "Coincido con Valeria. Y completa el perfil para que la comunidad sepa quién eres.", hours: 58 },
    { postIndex: 9, author: "lucia@alqemia.com", content: "47 dólares que valen más que cualquier curso motivacional. Felicidades!", hours: 70 },
    { postIndex: 10, author: "diego@alqemia.com", content: "Depende del país. Para flujo de caja rápido mira las que liquidan en 48-72h aunque cobren un poco más.", hours: 90 },
    { postIndex: 11, author: "diego@alqemia.com", content: "Ese programa es un MBA de verdad. La clase de finanzas debería ser obligatoria para todos.", hours: 110 },
  ]

  for (const c of comments) {
    await db.comment.create({
      data: {
        postId: postRecords[c.postIndex].id,
        userId: userIds[c.author],
        content: c.content,
        createdAt: hoursAgo(c.hours),
      },
    })
  }
  console.log(`Creados ${comments.length} comentarios`)

  console.log("Creando likes...")
  const likeMap: Record<number, string[]> = {
    0: ["diego@alqemia.com", "sofia@alqemia.com", "camila@alqemia.com", "lucia@alqemia.com", "sebastian@alqemia.com", "mateo@alqemia.com"],
    1: ["valeria@alqemia.com", "sofia@alqemia.com", "sebastian@alqemia.com"],
    2: ["valeria@alqemia.com", "isabela@alqemia.com", "lucia@alqemia.com", "daniel@alqemia.com"],
    3: ["sebastian@alqemia.com", "valeria@alqemia.com", "diego@alqemia.com"],
    4: ["mateo@alqemia.com", "camila@alqemia.com"],
    5: ["daniel@alqemia.com", "tomas@alqemia.com", "camila@alqemia.com", "isabela@alqemia.com"],
    6: ["camila@alqemia.com", "lucia@alqemia.com", "sofia@alqemia.com"],
    7: ["isabela@alqemia.com", "valeria@alqemia.com"],
    8: ["valeria@alqemia.com", "camila@alqemia.com", "sofia@alqemia.com", "mateo@alqemia.com", "lucia@alqemia.com"],
    9: ["lucia@alqemia.com", "sebastian@alqemia.com", "mateo@alqemia.com", "camila@alqemia.com"],
    10: ["diego@alqemia.com", "sofia@alqemia.com"],
    11: ["diego@alqemia.com", "valeria@alqemia.com", "daniel@alqemia.com", "lucia@alqemia.com", "tomas@alqemia.com"],
  }
  let likeCount = 0
  for (const [idxStr, authors] of Object.entries(likeMap)) {
    const idx = Number(idxStr)
    for (const a of authors) {
      if (a === postRecords[idx].authorEmail) continue
      await db.like.create({
        data: { postId: postRecords[idx].id, userId: userIds[a] },
      })
      likeCount++
    }
  }
  console.log(`Creados ${likeCount} likes`)

  console.log("Creando logros y progreso...")
  const achievementMap: Record<string, string[]> = {
    "valeria@alqemia.com": ["perfil_completo", "primer_post", "tres_posts", "primer_comentario", "primera_leccion", "cinco_lecciones", "curso_completo"],
    "diego@alqemia.com": ["perfil_completo", "primer_post", "tres_posts", "primer_comentario", "primera_leccion", "cinco_lecciones"],
    "sofia@alqemia.com": ["perfil_completo", "primer_post", "tres_posts", "primer_comentario", "primera_leccion", "cinco_lecciones"],
    "camila@alqemia.com": ["perfil_completo", "primer_post", "tres_posts", "primer_comentario", "primera_leccion", "cinco_lecciones", "curso_completo"],
    "lucia@alqemia.com": ["perfil_completo", "primer_post", "primer_comentario", "primera_leccion", "cinco_lecciones"],
    "sebastian@alqemia.com": ["perfil_completo", "primer_post", "primer_comentario", "primera_leccion"],
    "mateo@alqemia.com": ["perfil_completo", "primer_post", "primer_comentario"],
    "daniel@alqemia.com": ["perfil_completo", "primer_post", "primer_comentario", "primera_leccion"],
    "isabela@alqemia.com": ["perfil_completo"],
    "tomas@alqemia.com": ["perfil_completo", "primer_post", "primer_comentario", "primera_leccion"],
    "carlos@alqemia.com": ["perfil_completo"],
  }
  for (const [email, codes] of Object.entries(achievementMap)) {
    for (const code of codes) {
      await db.achievement.create({ data: { userId: userIds[email], code } }).catch(() => {})
    }
  }

  // Progreso de lecciones
  const progressMap: Record<string, string[]> = {
    "camila@alqemia.com": lessonIds["marketing-de-contenidos"], // curso completo
    "valeria@alqemia.com": lessonIds["ecommerce-desde-cero"].slice(0, 5),
    "sofia@alqemia.com": lessonIds["master-meta-ads"].slice(0, 5),
    "diego@alqemia.com": lessonIds["master-meta-ads"].slice(0, 4),
    "lucia@alqemia.com": lessonIds["copywriting-persuasivo"].slice(0, 4),
    "daniel@alqemia.com": lessonIds["ecommerce-desde-cero"].slice(0, 3),
    "tomas@alqemia.com": lessonIds["ecommerce-desde-cero"].slice(0, 2),
    "sebastian@alqemia.com": lessonIds["ecommerce-desde-cero"].slice(0, 2),
    "isabela@alqemia.com": lessonIds["ecommerce-desde-cero"].slice(0, 1),
  }
  for (const [email, lessonList] of Object.entries(progressMap)) {
    for (const lessonId of lessonList) {
      await db.lessonProgress
        .create({ data: { userId: userIds[email], lessonId } })
        .catch(() => {})
    }
  }
  console.log("Logros y progreso creados")

  console.log("Seed completado: ALQEMIA HUB listo")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

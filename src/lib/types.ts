// ============================================================
// ALQEMIA HUB — Contratos de tipos compartidos (frontend + API)
// ============================================================

export type UserStatus = "ACTIVE" | "BLOCKED"

export type LevelInfo = {
  level: number
  name: string
  currentXp: number
  xpIntoLevel: number
  xpForLevel: number
  nextLevelXp: number | null
  xpToNext: number | null
  progressPct: number // 0-100
}

export type XpAchievement = {
  code: string
  label: string
  icon: string
}

// ============================================================
// EL EVALUADOR — algoritmo interno que valora la evidencia
// (resultados reportados) y convierte avances reales en XP.
// ============================================================

export type EvidenceLine = {
  label: string
  detail: string
  xp: number
}

export type EvidenceVerdict = {
  total: number
  lines: EvidenceLine[]
  capped: boolean
}

export type XpEvent = {
  awarded: number
  totalXp: number
  level: LevelInfo
  leveledUp: boolean
  achievement?: XpAchievement
  /** Desglose de El Evaluador (solo cuando el XP viene de evidencia) */
  evidence?: EvidenceVerdict
}

export type MeAchievement = {
  code: string
  label: string
  icon: string
  createdAt: string
}

export type MeUser = {
  id: string
  name: string
  email: string
  role: "USER" | "ADMIN"
  image: string | null
  avatarColor: string | null
  headline: string | null
  bio: string | null // admite emojis alquímicos [a:xxx]
  goal: string | null
  experience: string | null
  coverImage: string | null // portada pública 16:9
  verified: boolean // chulito azul (titular y grandes maestres)
  xp: number
  status: UserStatus
  profileCompleted: boolean
  tourCompletedAt: string | null
  createdAt: string
  level: LevelInfo
  achievements: MeAchievement[]
}

export type MeResponse = {
  user: MeUser
  xp?: XpEvent | null
}

export type PostAuthor = {
  id: string
  name: string
  image: string | null
  avatarColor: string | null
  headline: string | null
  xp: number
  verified: boolean
  role: "USER" | "ADMIN" // el titular (ADMIN) muestra XP INFINITUM
}

export type FeedPost = {
  id: string
  content: string
  image: string | null
  createdAt: string
  user: PostAuthor
  likeCount: number
  likedByMe: boolean
  commentCount: number
  isOwn: boolean
  // Resultados reportados al publicar (evidencia del avance real)
  metricRevenue: number | null // facturación reportada (USD)
  metricOrders: number | null // pedidos reportados
  metricRoas: number | null // rentabilidad reportada (ROAS, ej. 3.2)
}

export type FeedResponse = {
  posts: FeedPost[]
  nextCursor: string | null
}

export type FeedComment = {
  id: string
  content: string
  createdAt: string
  user: PostAuthor
}

export type CourseSummary = {
  id: string
  slug: string
  title: string
  description: string
  level: string
  cover: string
  totalLessons: number
  totalMinutes: number
  completedLessons: number
}

export type LessonDTO = {
  id: string
  title: string
  description: string
  videoUrl: string | null
  durationMin: number
  order: number
  completed: boolean
}

export type CourseDetail = CourseSummary & {
  lessons: LessonDTO[]
}

export type LeaderboardEntry = {
  id: string
  name: string
  image: string | null
  avatarColor: string | null
  headline: string | null
  xp: number
  level: LevelInfo
  verified: boolean
  role: "USER" | "ADMIN" // el titular siempre es #1 con XP INFINITUM
}

export type AdminUserRow = {
  id: string
  name: string
  email: string
  image: string | null
  avatarColor: string | null
  role: "USER" | "ADMIN"
  status: UserStatus
  xp: number
  level: LevelInfo
  postCount: number
  commentCount: number
  lessonsCompleted: number
  createdAt: string
  lastActiveAt: string
}

export type AdminStats = {
  totalUsers: number
  activeUsers7d: number
  blockedUsers: number
  totalPosts: number
  totalComments: number
  totalLikes: number
  lessonsCompleted7d: number
  totalXp: number
  signupsByDay: { date: string; count: number }[]
  topCreators: {
    id: string
    name: string
    image: string | null
    avatarColor: string | null
    xp: number
    posts: number
    comments: number
  }[]
}

export type CopyLabType = "product" | "social" | "ad" | "email"

/** Variante de copy de élite: framework + texto + gatillos usados + por qué funciona. */
export type CopyLabVariant = {
  framework: string
  copy: string
  triggers: string[]
  why: string
}

/** Niveles de conciencia de Eugene Schwartz (elevación de conciencia). */
export type CopyLabAwareness =
  | "auto"
  | "unconscious"
  | "problem"
  | "solution"
  | "product"
  | "most"

export type ApiErrorShape = { error: string }

// ============================================================
// INVITACIONES (registro solo por código del titular)
// ============================================================

export type InviteStatus = "PENDING" | "USED" | "EXPIRED"

export type InviteDTO = {
  id: string
  code: string
  email: string
  note: string | null
  status: InviteStatus
  createdAt: string
  usedAt: string | null
  usedBy: string | null // email del miembro que lo usó
  expiresAt: string | null
}

// ============================================================
// EN VIVO
// ============================================================

export type LiveStatus = "SCHEDULED" | "LIVE" | "ENDED"

export type LiveSessionDTO = {
  id: string
  title: string
  description: string
  status: LiveStatus
  scheduledAt: string
  coverImage: string | null
  streamUrl: string | null
  replayUrl: string | null
  createdAt: string
}

export type LiveResponse = {
  current: LiveSessionDTO | null
  next: LiveSessionDTO | null
  replays: LiveSessionDTO[]
}

// ============================================================
// MARKETPLACE
// ============================================================

export type ProductCategory = "MICRO_APP" | "DIGITAL" | "PHYSICAL" | "SERVICE"

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "MICRO_APP", label: "Micro Apps" },
  { value: "DIGITAL", label: "Productos Digitales" },
  { value: "PHYSICAL", label: "Productos Físicos" },
  { value: "SERVICE", label: "Servicios" },
]

export function productCategoryLabel(v: string): string {
  return PRODUCT_CATEGORIES.find((c) => c.value === v)?.label ?? v
}

export type ProductDTO = {
  id: string
  title: string
  description: string
  category: ProductCategory | string
  price: number
  currency: string
  commissionPct: number
  recurring: boolean
  coverImage: string | null
  contentUrl: string | null // solo visible al dueño y aliados
  status: "ACTIVE" | "PAUSED" | string
  views: number
  createdAt: string
  seller: { id: string; name: string; image: string | null; avatarColor: string | null; headline: string | null }
  isMine: boolean
  isAlly: boolean // lo tengo en mis Aliados
  alliesCount: number
  salesCount: number
}

export type SaleDTO = {
  id: string
  productId: string
  productTitle: string
  buyerName: string
  buyerContact: string | null
  amount: number
  currency: string
  commission: number
  proofImage: string | null
  note: string | null
  status: "PENDING" | "CONFIRMED" | string
  createdAt: string
  reseller: { id: string; name: string; image: string | null; avatarColor: string | null }
}

/** Métricas del negocio de un miembro (como aliado y como creador) */
export type AllyMetrics = {
  asAlly: {
    totalSales: number
    confirmedSales: number
    pendingSales: number
    commissionEarned: number
    recentSales: SaleDTO[]
  }
  asCreator: {
    totalProducts: number
    totalSales: number
    revenue: number // suma de montos confirmados
    paidToAllies: number // comisiones confirmadas
    products: {
      id: string
      title: string
      category: string
      price: number
      currency: string
      views: number
      salesCount: number
      conversionPct: number
      allies: {
        id: string
        name: string
        image: string | null
        avatarColor: string | null
        salesCount: number
        revenue: number
        commission: number
      }[]
      pendingSales: SaleDTO[]
    }[]
  }
}

// ============================================================
// ASISTENTE IA
// ============================================================

export type ChatMsg = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
  conversationId: string | null
  /** "image" → content lleva el prompt y imageData el PNG base64 (dataURL) */
  kind: "text" | "image"
  imagePrompt: string | null
  imageSize: string | null
  imageData: string | null
}

export type ConversationSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type OracleImageResponse = {
  msg: ChatMsg
}

// ============================================================
// PERFIL PÚBLICO
// ============================================================

/** Métricas de negocio reportadas por un miembro en sus posts */
export type PublicResults = {
  reports: number // posts con resultados reportados
  totalRevenue: number // suma de facturación reportada (USD)
  totalOrders: number // suma de pedidos reportados
  avgRoas: number | null // ROAS promedio de los reportes
  lastReportAt: string | null
}

export type PublicProfileUser = {
  id: string
  name: string
  image: string | null
  avatarColor: string | null
  headline: string | null
  bio: string | null // admite emojis alquímicos [a:xxx]
  coverImage: string | null
  verified: boolean
  xp: number
  level: LevelInfo
  createdAt: string
  experience: string | null
  role: "USER" | "ADMIN"
  postCount: number
  commentCount: number
  achievements: MeAchievement[]
  results: PublicResults
  isOwn: boolean
}

// ============================================================
// EL GRIMORIO — códigos de las creaciones (estilo GitHub)
// ============================================================

export type CodeVisibility = "PRIVATE" | "PUBLIC"

export type CodeDTO = {
  id: string
  title: string
  description: string
  language: string
  fileName: string
  visibility: CodeVisibility | string
  tags: string | null
  forksCount: number
  forkedFromId: string | null
  forkedFromTitle: string | null
  createdAt: string
  updatedAt: string
  owner: {
    id: string
    name: string
    image: string | null
    avatarColor: string | null
    headline: string | null
    role: "USER" | "ADMIN"
  }
  isMine: boolean
}

/** Versión extendida con el contenido (solo detalle del código) */
export type CodeDetailDTO = CodeDTO & {
  content: string
}

export const CODE_LANGUAGES: { value: string; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "php", label: "PHP" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "swift", label: "Swift" },
  { value: "react", label: "React / JSX" },
  { value: "markdown", label: "Markdown" },
  { value: "yaml", label: "YAML" },
  { value: "texto", label: "Texto plano" },
]

export function codeLanguageLabel(v: string): string {
  return CODE_LANGUAGES.find((l) => l.value === v)?.label ?? v
}

// ============================================================
// AJUSTES DEL HUB (clave/valor gestionados desde el Panel Admin)
// ============================================================

export type HubSettings = {
  muroVideo: string | null // URL de vídeo (YouTube/mp4) entre el título del muro y la caja de escribir
}

// ============================================================
// VOZ IA — catálogo de voces del generador de audio
// ============================================================

export type TtsEngine = "google" | "casa"

export type TtsVoice = {
  id: string
  engine: TtsEngine
  label: string
  desc: string
  flag: string
}

export const TTS_VOICES: TtsVoice[] = [
  { id: "es", engine: "google", label: "Español España", desc: "Castellano neutro", flag: "ES" },
  { id: "es-US", engine: "google", label: "Español Latino", desc: "Acento latino de EE. UU.", flag: "LATAM" },
  { id: "es-MX", engine: "google", label: "Español Mexicano", desc: "Acento mexicano", flag: "MX" },
  { id: "pt", engine: "google", label: "Portugués", desc: "Brasil", flag: "BR" },
  { id: "en", engine: "google", label: "Inglés", desc: "US", flag: "EN" },
  { id: "fr", engine: "google", label: "Francés", desc: "Francia", flag: "FR" },
  { id: "it", engine: "google", label: "Italiano", desc: "Italia", flag: "IT" },
  { id: "de", engine: "google", label: "Alemán", desc: "Alemania", flag: "DE" },
  { id: "ja", engine: "google", label: "Japonés", desc: "Japón", flag: "JA" },
  { id: "ko", engine: "google", label: "Coreano", desc: "Corea", flag: "KO" },
  { id: "zh", engine: "google", label: "Chino", desc: "Mandarín", flag: "ZH" },
  { id: "ru", engine: "google", label: "Ruso", desc: "Rusia", flag: "RU" },
  { id: "ar", engine: "google", label: "Árabe", desc: "Internacional", flag: "AR" },
  { id: "hi", engine: "google", label: "Hindi", desc: "India", flag: "HI" },
  { id: "jam", engine: "casa", label: "Jam", desc: "Caballero británico · voz de la casa", flag: "PRO" },
  { id: "kazi", engine: "casa", label: "Kazi", desc: "Locutor claro y estándar", flag: "PRO" },
  { id: "tongtong", engine: "casa", label: "TongTong", desc: "Cálida y cercana", flag: "PRO" },
  { id: "xiaochen", engine: "casa", label: "XiaoChen", desc: "Sobria y profesional", flag: "PRO" },
  { id: "douji", engine: "casa", label: "DouJi", desc: "Natural y fluida", flag: "PRO" },
  { id: "luodo", engine: "casa", label: "LuoDo", desc: "Expresiva y con fuerza", flag: "PRO" },
  { id: "chuichui", engine: "casa", label: "ChuiChui", desc: "Dulce y juguetona", flag: "PRO" },
]

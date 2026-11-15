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

export type XpEvent = {
  awarded: number
  totalXp: number
  level: LevelInfo
  leveledUp: boolean
  achievement?: XpAchievement
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
  postCount: number
  commentCount: number
  achievements: MeAchievement[]
  results: PublicResults
  isOwn: boolean
}

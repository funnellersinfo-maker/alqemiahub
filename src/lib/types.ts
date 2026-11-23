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
// VOZ IA — catálogo de voces neuronales en español latino
// (servicio gratuito de voces neuronales de Microsoft Edge:
//  40 voces, 20 países/regiones de toda Latinoamérica)
// ============================================================

export type TtsVoiceGender = "F" | "M"

export type TtsVoiceRegion = "Norteamérica" | "Centroamérica" | "Caribe" | "Sudamérica"

export type TtsVoiceOption = {
  /** Identificador del servicio, p. ej. "es-MX-DaliaNeural" */
  id: string
  /** Nombre legible, p. ej. "Dalia" */
  name: string
  gender: TtsVoiceGender
}

export type TtsCountry = {
  /** Código de país para la insignia, p. ej. "MX" */
  cc: string
  /** Nombre en español, p. ej. "México" */
  country: string
  region: TtsVoiceRegion
  voices: [TtsVoiceOption, TtsVoiceOption]
}

export const TTS_COUNTRIES: TtsCountry[] = [
  { cc: "MX", country: "México", region: "Norteamérica", voices: [
    { id: "es-MX-DaliaNeural", name: "Dalia", gender: "F" },
    { id: "es-MX-JorgeNeural", name: "Jorge", gender: "M" },
  ]},
  { cc: "US", country: "Latino de EE. UU.", region: "Norteamérica", voices: [
    { id: "es-US-PalomaNeural", name: "Paloma", gender: "F" },
    { id: "es-US-AlonsoNeural", name: "Alonso", gender: "M" },
  ]},
  { cc: "CR", country: "Costa Rica", region: "Centroamérica", voices: [
    { id: "es-CR-MariaNeural", name: "María", gender: "F" },
    { id: "es-CR-JuanNeural", name: "Juan", gender: "M" },
  ]},
  { cc: "SV", country: "El Salvador", region: "Centroamérica", voices: [
    { id: "es-SV-LorenaNeural", name: "Lorena", gender: "F" },
    { id: "es-SV-RodrigoNeural", name: "Rodrigo", gender: "M" },
  ]},
  { cc: "GT", country: "Guatemala", region: "Centroamérica", voices: [
    { id: "es-GT-MartaNeural", name: "Marta", gender: "F" },
    { id: "es-GT-AndresNeural", name: "Andrés", gender: "M" },
  ]},
  { cc: "HN", country: "Honduras", region: "Centroamérica", voices: [
    { id: "es-HN-KarlaNeural", name: "Karla", gender: "F" },
    { id: "es-HN-CarlosNeural", name: "Carlos", gender: "M" },
  ]},
  { cc: "NI", country: "Nicaragua", region: "Centroamérica", voices: [
    { id: "es-NI-YolandaNeural", name: "Yolanda", gender: "F" },
    { id: "es-NI-FedericoNeural", name: "Federico", gender: "M" },
  ]},
  { cc: "PA", country: "Panamá", region: "Centroamérica", voices: [
    { id: "es-PA-MargaritaNeural", name: "Margarita", gender: "F" },
    { id: "es-PA-RobertoNeural", name: "Roberto", gender: "M" },
  ]},
  { cc: "CU", country: "Cuba", region: "Caribe", voices: [
    { id: "es-CU-BelkysNeural", name: "Belkys", gender: "F" },
    { id: "es-CU-ManuelNeural", name: "Manuel", gender: "M" },
  ]},
  { cc: "PR", country: "Puerto Rico", region: "Caribe", voices: [
    { id: "es-PR-KarinaNeural", name: "Karina", gender: "F" },
    { id: "es-PR-VictorNeural", name: "Víctor", gender: "M" },
  ]},
  { cc: "DO", country: "Rep. Dominicana", region: "Caribe", voices: [
    { id: "es-DO-RamonaNeural", name: "Ramona", gender: "F" },
    { id: "es-DO-EmilioNeural", name: "Emilio", gender: "M" },
  ]},
  { cc: "AR", country: "Argentina", region: "Sudamérica", voices: [
    { id: "es-AR-ElenaNeural", name: "Elena", gender: "F" },
    { id: "es-AR-TomasNeural", name: "Tomás", gender: "M" },
  ]},
  { cc: "BO", country: "Bolivia", region: "Sudamérica", voices: [
    { id: "es-BO-SofiaNeural", name: "Sofía", gender: "F" },
    { id: "es-BO-MarceloNeural", name: "Marcelo", gender: "M" },
  ]},
  { cc: "CL", country: "Chile", region: "Sudamérica", voices: [
    { id: "es-CL-CatalinaNeural", name: "Catalina", gender: "F" },
    { id: "es-CL-LorenzoNeural", name: "Lorenzo", gender: "M" },
  ]},
  { cc: "CO", country: "Colombia", region: "Sudamérica", voices: [
    { id: "es-CO-SalomeNeural", name: "Salomé", gender: "F" },
    { id: "es-CO-GonzaloNeural", name: "Gonzalo", gender: "M" },
  ]},
  { cc: "EC", country: "Ecuador", region: "Sudamérica", voices: [
    { id: "es-EC-AndreaNeural", name: "Andrea", gender: "F" },
    { id: "es-EC-LuisNeural", name: "Luis", gender: "M" },
  ]},
  { cc: "PY", country: "Paraguay", region: "Sudamérica", voices: [
    { id: "es-PY-TaniaNeural", name: "Tania", gender: "F" },
    { id: "es-PY-MarioNeural", name: "Mario", gender: "M" },
  ]},
  { cc: "PE", country: "Perú", region: "Sudamérica", voices: [
    { id: "es-PE-CamilaNeural", name: "Camila", gender: "F" },
    { id: "es-PE-AlexNeural", name: "Alex", gender: "M" },
  ]},
  { cc: "UY", country: "Uruguay", region: "Sudamérica", voices: [
    { id: "es-UY-ValentinaNeural", name: "Valentina", gender: "F" },
    { id: "es-UY-MateoNeural", name: "Mateo", gender: "M" },
  ]},
  { cc: "VE", country: "Venezuela", region: "Sudamérica", voices: [
    { id: "es-VE-PaolaNeural", name: "Paola", gender: "F" },
    { id: "es-VE-SebastianNeural", name: "Sebastián", gender: "M" },
  ]},
]

/** Conjunto de todos los ids de voz válidos (validación del backend). */
export const TTS_VOICE_IDS = new Set(TTS_COUNTRIES.flatMap((c) => c.voices.map((v) => v.id)))

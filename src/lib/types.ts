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
  bio: string | null
  goal: string | null
  experience: string | null
  xp: number
  status: UserStatus
  profileCompleted: boolean
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

export type ApiErrorShape = { error: string }

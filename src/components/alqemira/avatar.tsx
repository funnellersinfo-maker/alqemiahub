"use client"

import { cn } from "@/lib/utils"

// Paleta de colores para avatares preset (sin azules)
export const AVATAR_COLORS = [
  "#d97706", // amber
  "#059669", // emerald
  "#e11d48", // rose
  "#0d9488", // teal
  "#ea580c", // orange
  "#65a30d", // lime
  "#a8a29e", // stone
  "#c026d3", // fuchsia
]

type AvatarUser = {
  name: string
  image?: string | null
  avatarColor?: string | null
}

const SIZES: Record<string, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
  "2xl": "h-24 w-24 text-3xl",
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "A"
  const first = parts[0][0] ?? ""
  const second = parts[1]?.[0] ?? ""
  return (first + second).toUpperCase() || "A"
}

function colorOf(name: string, fallback?: string | null): string {
  if (fallback && /^#[0-9a-fA-F]{6}$/.test(fallback)) return fallback
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function UserAvatar({
  user,
  size = "md",
  className,
}: {
  user: AvatarUser
  size?: keyof typeof SIZES
  className?: string
}) {
  const sizeCls = SIZES[size] ?? SIZES.md

  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={`Avatar de ${user.name}`}
        className={cn("rounded-full object-cover ring-1 ring-zinc-200 select-none", sizeCls, className)}
        draggable={false}
      />
    )
  }

  return (
    <div
      aria-label={`Avatar de ${user.name}`}
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white select-none shrink-0",
        sizeCls,
        className
      )}
      style={{ backgroundColor: colorOf(user.name, user.avatarColor) }}
    >
      {initialsOf(user.name)}
    </div>
  )
}

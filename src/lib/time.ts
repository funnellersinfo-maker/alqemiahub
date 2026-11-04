// Utilidades de fecha en español para la UI

function toDate(input: string | Date): Date {
  return typeof input === "string" ? new Date(input) : input
}

export function timeAgo(input: string | Date): string {
  const date = toDate(input)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return "hace un instante"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return "ayer"
  if (days < 7) return `hace ${days} días`
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} ${months === 1 ? "mes" : "meses"}`
  return formatDate(input)
}

export function formatDate(input: string | Date): string {
  const date = toDate(input)
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(date)
}

export function formatShortDate(input: string | Date): string {
  const date = toDate(input)
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(date)
}

export function formatDayLabel(isoDay: string): string {
  // "2025-03-05" -> "5 mar"
  const [y, m, d] = isoDay.split("-").map(Number)
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" }).format(date)
}

"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-14", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 mb-4">
        <Icon className="h-6 w-6 text-gold-deep" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-zinc-500 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

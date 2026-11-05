"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import type { MeResponse } from "@/lib/types"

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/me")
  if (!res.ok) throw new Error("No autenticado")
  return res.json()
}

/**
 * Hook central del usuario autenticado.
 * `me.data?.user` es el perfil fresco con nivel y logros.
 * Refresca automáticamente al enfocarse la ventana.
 */
export function useMe() {
  const { data: session, status } = useSession()
  const query = useQuery<MeResponse>({
    queryKey: ["me", session?.user?.id ?? null],
    queryFn: fetchMe,
    enabled: status === "authenticated",
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })
  return { ...query, session, sessionStatus: status }
}

"use client"

// ============================================================
// ADMIN — Fetch autenticado con clave de admin (localStorage)
// Módulo compartido por todas las vistas del panel.
// ============================================================

import { useAppStore } from "@/lib/store"

/**
 * fetch con la clave de admin guardada en localStorage
 * ("alqemia-admin-key", cabecera "x-admin-key").
 * Si el servidor responde 401, cierra la sesión del panel
 * (setAdminUnlocked(false)) y lanza "Sesión de admin cerrada".
 */
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const key = localStorage.getItem("alqemia-admin-key") ?? ""
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": key,
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) {
    useAppStore.getState().setAdminUnlocked(false)
    throw new Error("Sesión de admin cerrada")
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? "Error inesperado")
  }
  return res.json() as Promise<T>
}

/** ¿El error es por sesión de admin cerrada (401)? */
export function isLockedError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("admin cerrada")
}

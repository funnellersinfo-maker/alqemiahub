"use client"

// Página principal del Hub ALQEMIRA.
// El integrador conectará aquí: AuthView -> Onboarding -> AppShell.

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white gap-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 animate-logo-glow" />
      <p className="font-display text-sm tracking-[0.3em] text-amber-300/80">ALQEMIRA</p>
    </main>
  );
}

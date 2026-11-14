// ============================================================
// ALQEMIA — Canonicalización de dominio
// ------------------------------------------------------------
// El Hub corre en el Worker (workers.dev) pero el enlace oficial
// es https://alqemiahub.pages.dev (portal inverso en Pages).
// Cualquier visita directa al dominio interno se redirige (308)
// al enlace limpio para:
//   · Mantener una única URL pública
//   · Que NextAuth valide siempre contra NEXTAUTH_URL (pages.dev)
//   · Migrar marcadores/QR antiguos con la URL larga
// Las peticiones internas del portal llegan con "x-alqemia-portal"
// y NO se redirigen (evita bucles). Localhost y previews tampoco.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";

const PORTAL_HOST = "alqemiahub.pages.dev";
const UPSTREAM_HOST = "alqemiahub.mastershop-funnellers.workers.dev";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();

  // Solo aplicar al dominio interno del worker (no localhost, previews ni portal)
  if (host !== UPSTREAM_HOST) return NextResponse.next();

  // Petición interna del portal: servir sin redirigir
  if (request.headers.get("x-alqemia-portal") === "1") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = PORTAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Todo excepto assets puros del framework (que ni llegan al worker)
  matcher: ["/((?!_next/static|_next/image).*)"],
};

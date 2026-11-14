// ============================================================
// ALQEMIA — Portal del enlace limpio (Cloudflare Pages)
// ------------------------------------------------------------
// Sirve TODO el Hub en https://alqemiahub.pages.dev actuando como
// proxy inverso hacia el Worker de OpenNext:
//   https://alqemiahub.mastershop-funnellers.workers.dev
//
// Así la barra de direcciones del usuario SIEMPRE permanece en
// el enlace limpio (pages.dev) y el dominio interno de workers.dev
// deja de exponerse (además evita bloqueos de operadores móviles
// que filtran *.workers.dev).
//
// Notas:
//  · Marca interna "x-alqemia-portal: 1" → el middleware del Hub
//    reconoce las peticiones del portal y NO redirige (sin bucles).
//  · redirect: "manual" + reescritura de Location para que ninguna
//    redirección absoluta saque al usuario del enlace limpio.
//  · El cuerpo se pasa en streaming (SSE del Oráculo incluido).
// ============================================================

const UPSTREAM_ORIGIN = "https://alqemiahub.mastershop-funnellers.workers.dev";
const UPSTREAM_HOST = "alqemiahub.mastershop-funnellers.workers.dev";
const PORTAL_ORIGIN = "https://alqemiahub.pages.dev";

function toUpstreamUrl(url) {
  const target = new URL(url);
  target.protocol = "https:";
  target.host = UPSTREAM_HOST;
  target.port = "";
  return target;
}

const portalWorker = {
  async fetch(request) {
    const url = new URL(request.url);

    // Upgrades (websocket): pasar tal cual
    const upgrade = (request.headers.get("upgrade") || "").toLowerCase();
    if (upgrade === "websocket") {
      return fetch(new Request(toUpstreamUrl(url), request));
    }

    const headers = new Headers(request.headers);
    // Marca interna para el middleware del Hub (evita redirect canónico)
    headers.set("x-alqemia-portal", "1");

    const method = request.method.toUpperCase();
    const upstreamReq = new Request(toUpstreamUrl(url), {
      method: request.method,
      headers,
      // GET/HEAD no llevan cuerpo; el resto se transmite en streaming
      body: method === "GET" || method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });

    const res = await fetch(upstreamReq);

    // Pase de respuesta: conserva streaming, cookies y cabeceras
    const out = new Response(res.body, res);
    out.headers.delete("content-length");
    if (out.headers.has("content-encoding")) out.headers.delete("content-encoding");

    // Reescribir redirecciones absolutas que apunten al dominio interno
    const location = out.headers.get("location");
    if (location && location.includes(UPSTREAM_HOST)) {
      out.headers.set(
        "location",
        location
          .split("https://" + UPSTREAM_HOST)
          .join(PORTAL_ORIGIN)
          .split("http://" + UPSTREAM_HOST)
          .join(PORTAL_ORIGIN)
      );
    }

    return out;
  },
};

export default portalWorker;

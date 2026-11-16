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
    const canRetry = method === "GET" || method === "HEAD"; // sin cuerpo → reintentable
    const buildUpstream = () =>
      new Request(toUpstreamUrl(url), {
        method: request.method,
        headers,
        // GET/HEAD no llevan cuerpo; el resto se transmite en streaming
        body: canRetry ? undefined : request.body,
        redirect: "manual",
      });

    // Reinteno único ante fallos de red / cold-start del Worker interno
    // (redes móviles inestables, primer arranque, modo incógnito). Si aun
    // así falla, se entrega una página elegante en vez del error seco de
    // Cloudflare.
    let res;
    try {
      res = await fetch(buildUpstream());
    } catch (err) {
      if (!canRetry) throw err;
      try {
        res = await fetch(buildUpstream());
      } catch {
        return new Response(
          '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ALQEMIA</title><style>body{background:#050505;color:#d4af37;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center}div{padding:2rem;max-width:28rem}h1{font-size:1.05rem;font-weight:600;letter-spacing:.08em}p{color:#a1a1aa;font-size:.85rem;line-height:1.6}</style></head><body><div><h1>ALQEMIA</h1><p>La conexión con el Hub se cayó un instante.<br>Vuelve a cargar la página en unos segundos.</p></div></body></html>',
          { status: 502, headers: { "content-type": "text/html; charset=utf-8" } }
        );
      }
    }

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

// ============================================================
// ALQEMIA — Portal del enlace limpio (Cloudflare Pages)
// ------------------------------------------------------------
// Sirve TODO el Hub en https://alqemiahub.pages.dev actuando como
// proxy inverso hacia el Worker de OpenNext:
//   https://alqemiahub.mastershop-funnellers.workers.dev
//
// VÍDEOS (/api/media/*): se enrutan al worker de relé dedicado
// alqemia-media (workerd puro, sin Node.js). Servir vídeos grandes
// a través de OpenNext excedía el límite de CPU del Worker (Error
// 1102) y la página se caía. El relé ligero transmite los bytes
// del Durable Object con coste de CPU casi nulo → HD fluido con
// cualquier tamaño de vídeo.
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
// Worker de relé de vídeos (firma HMAC ?e=&s= en la propia URL)
const MEDIA_HOST = "alqemia-media.mastershop-funnellers.workers.dev";
const PORTAL_ORIGIN = "https://alqemiahub.pages.dev";

function toUpstreamUrl(url, upstreamHost) {
  const target = new URL(url);
  target.protocol = "https:";
  target.host = upstreamHost;
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
    // Vídeos → media worker; resto → OpenNext
    const upstreamHost = url.pathname.startsWith("/api/media/") ? MEDIA_HOST : UPSTREAM_HOST;
    const buildUpstream = () =>
      new Request(toUpstreamUrl(url, upstreamHost), {
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

    // Pase de respuesta: conserva streaming, cookies y cabeceras.
    //
    // CRÍTICO para los vídeos (/api/media): el Content-Length debe
    // conservarse. Si se elimina, las respuestas 206 parcial llegan
    // "en chunks" sin longitud conocida y la caché multimedia del
    // navegador se corrompe (el vídeo se reproduce una vez y luego se
    // queda pegado). workerd solo respeta Content-Length cuando el
    // cuerpo es un stream de longitud fija → FixedLengthStream.
    const upstreamLen = res.headers.get("content-length");
    const hasEncoding = res.headers.has("content-encoding");
    const noBodyStatus =
      res.status === 204 || res.status === 205 || res.status === 304 || method === "HEAD";

    let out;
    if (upstreamLen && !hasEncoding && res.body && !noBodyStatus) {
      const n = parseInt(upstreamLen, 10);
      if (Number.isFinite(n) && n >= 0) {
        // Longitud conocida → stream de longitud fija + Content-Length real
        const fls = new FixedLengthStream(n);
        res.body.pipeTo(fls.writable).catch(() => {});
        out = new Response(fls.readable, res);
        out.headers.set("content-length", upstreamLen);
      }
    }
    if (!out) {
      out = new Response(noBodyStatus ? null : res.body, res);
      // En respuestas SIN CUERPO (204/205/304/HEAD) el Content-Length
      // es metadato válido (tamaño del recurso) y SE conserva. Solo se
      // elimina para cuerpos en streaming de longitud desconocida.
      if (!noBodyStatus) out.headers.delete("content-length");
    }
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

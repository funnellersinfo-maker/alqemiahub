# 4-c — Subsistema de REPORTE DE RESULTADOS (evidencia tipo Skool)

Agente: 4-c (reporte de resultados / evidencia pública al publicar)
Fecha: 2026-11-15
Estado: COMPLETADO. `bun run lint` sin errores. dev.log sin errores de compilación. Smoke test API end-to-end OK (posts con métricas, XP combinado, logro, validaciones 400, comments con verified, feed con métricas). Datos de prueba eliminados.

## Qué hace este subsistema

Al publicar en el muro, el miembro puede desplegar "Reportar resultados del período" y adjuntar facturación (USD), pedidos y ROAS. Si al menos una cifra es > 0, el post queda marcado como EVIDENCIA pública: chips dorados bajo el contenido (+25 XP extra y logro "Primera Evidencia" la primera vez). Además, el feed muestra el seldo azul de cuenta verificada en autores de posts y comentarios, y el avatar/nombre abre el perfil público vía evento `alqemia:open-profile`.

## Archivos modificados/creados (SOLO estos)

- `src/lib/verified.ts` (NUEVO) — helper `isVerifiedUser({verified, role, xp})`: verified===true || role==="ADMIN" || xp>=2400. Creado aparte para NO chocar con 4-a (que añade el suyo en lib/profile.ts).
- `src/lib/levels.ts` — ACHIEVEMENTS añade `primer_reporte: { label: "Primera Evidencia", icon: "FileBarChart" }` (solo esa línea).
- `src/lib/gamification.ts` — XP_REWARDS añade `report: 25`; XpAction añade `"report"`; en `awardXpFor`, rama `action === "report"`: cuenta posts del usuario con alguna métrica no nula (`OR: [metricRevenue not null, metricOrders not null, metricRoas not null]`) y si >= 1 otorga logro `primer_reporte`.
- `src/lib/feed.ts` — `toFeedPost` ahora mapea `metricRevenue/metricOrders/metricRoas` (con `?? null`) y `user.verified: isVerifiedUser(post.user)`. `feedInclude` intacto (`user: true` trae todas las columnas). /api/feed y /api/admin/posts ya usaban toFeedPost → las métricas fluyen solas.
- `src/app/api/posts/route.ts` — POST acepta métricas opcionales validadas: revenue 0..10.000.000 (redondeo 2 dec), orders entero 0..100.000, roas 0..100 (1 dec). Vacío/0 → null. Valor presente pero no finito o fuera de rango → 400 con mensaje en español (usa ApiError + handleApiError). Si alguna métrica > 0: `awardXpFor(post)` + `awardXpFor(report)` y devuelve un xp event COMBINADO (awarded = 15+25 = 40, totalXp/level/leveledUp del reporte que es el más reciente, achievement priorizando el del reporte y conservando el del post si aquel no trae). Contrato `{ post, xp }` intacto; máx 1 reporte-XP por post (solo al crear).
- `src/app/api/posts/[id]/comments/route.ts` — GET y POST mapean `verified: isVerifiedUser(...)` en el `user` del comentario (FeedComment.user es PostAuthor que exige `verified`).
- `src/components/alqemia/feed/post-card.tsx` — BadgeCheck (fill-sky-400) junto al nombre si `user.verified`; avatar y nombre son `<button>` discretos (cursor-pointer, hover:text-gold-bright, aria-label "Ver perfil de {nombre}") que despachan `window.dispatchEvent(new CustomEvent("alqemia:open-profile", { detail: post.user.id }))`; tras el contenido, si hay métricas: separador "EVIDENCIA" (text-[9px] tracking-[0.2em] text-gold/60 + línea bg-gold/20) y chips dorados (DollarSign +formato compacto es / Package "N pedidos" / TrendingUp "ROAS xN.N") con estilo `border-gold/30 bg-gold/10 text-gold-bright`.
- `src/components/alqemia/feed/comments-section.tsx` — mismo tratamiento en comentarios: avatar+nombre clickables a perfil y BadgeCheck verificado (h-3 w-3).
- `src/components/alqemia/feed/post-composer.tsx` — Collapsible (shadcn/ui) "Reportar resultados del período" bajo el textarea: trigger discreto con FileBarChart + AlqemiaLetters (strokeWidth 11, no modifiqué el archivo de lettering) + ChevronDown que rota 180°. Al abrir: grid grid-cols-2 sm:grid-cols-3 con inputs (Facturación USD / Pedidos / ROAS con title "Retorno sobre inversión publicitaria"), nota de solo cifras reales (+25 XP, evidencia pública). Al publicar: validación cliente (mismos rangos que el server, toast de error), envía métricas SOLO si > 0, resetea métricas y cierra el collapsible al éxito. celebrateXp existente se mantiene (ahora celebra el evento combinado +40).

## Decisiones

1. XP combinado: el evento devuelto cuando hay reporte resume ambos premios (awarded 40) para que el toast muestre el total real; level/totalXp vienen del evento del reporte (el último en aplicarse). Si el reporte no trae logro, se conserva el del post (p.ej. primer_post).
2. Validación estricta de métricas: valor presente pero inválido → 400 (no se guarda en silencio); vacío/0/null → null (no cuenta como evidencia). Cliente valida igual con toasts claros antes de enviar.
3. `primer_reporte` se evalúa con count >= 1 tras crear el post (la primera vez siempre dispara, incluido el propio post recién creado).
4. Helper propio `src/lib/verified.ts` para evitar conflicto de merge con 4-a (lib/profile.ts).
5. Avatar envuelto en `<button>` (UserAvatar no acepta onClick) con hover:scale-105 sutil y focus ring dorado; touch target ya >= 40px (avatar md = 40px).
6. Formato compacto con `Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 })` instanciado a nivel de módulo.

## Contrato con otros agentes

- El evento `alqemia:open-profile` (detail = userId) ya se despacha desde post-card y comments-section. El app-shell (otro agente) debe escucharlo y abrir el perfil público.
- `FeedPost`/`PostAuthor`/`FeedComment` ya traen metricRevenue/metricOrders/metricRoas y verified; admin posts y feed los sirven vía toFeedPost sin cambios extra.

## Pendientes / notas

- Ninguno bloqueante. El único registro `prisma:error` en dev.log es el detector de logro duplicado de grantAchievement (patrón preexistente: unique constraint como "ya otorgado", capturado y manejado); no es un fallo.
- Icono FileBarChart del logro existe en lucide-react (verificado en uso del composer).

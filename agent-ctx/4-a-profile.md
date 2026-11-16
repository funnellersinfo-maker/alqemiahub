# 4-a — Subsistema de PERFIL PÚBLICO (ALQEMIA)

Task ID: **4-a** · Estado: **completado** · `bun run lint` sin errores · dev.log sin errores de compilación.

## Archivos creados / modificados

| Archivo | Cambio |
|---|---|
| `src/lib/profile.ts` | Añadido `isVerifiedUser(user)` — regla única del chulito azul: `verified === true \|\| role === "ADMIN" \|\| xp >= 2400`. |
| `src/app/api/me/route.ts` | `buildMeUser` ahora serializa `coverImage` y `verified` (vía `isVerifiedUser`). PATCH acepta `coverImage`: dataURL `data:image/*` ≤ 400.000 chars, `null` o `""` la quitan. |
| `src/app/api/users/[id]/route.ts` | **NUEVO** GET perfil público (`PublicProfileUser`). `requireActiveUser`; 404 "Miembro no encontrado" si no existe o está BLOCKED; logros ordenados createdAt asc mapeados con ACHIEVEMENTS; counts con `db.post.count`/`db.comment.count`; `results` con un solo `db.post.aggregate` (`OR` de métricas not null): reports=_count, totalRevenue=_sum, totalOrders=_sum, avgRoas=_avg, lastReportAt=_max.createdAt; `isOwn = id === me.id`. |
| `src/app/api/leaderboard/route.ts` | Añadido `verified` (select + `isVerifiedUser`) a cada entrada. |
| `src/components/alqemia/profile/profile-view.tsx` | Reescrito. Props `userId?` / `onBack?`. Modo propio: useMe + query `["public-user", meId]` para counts/resultados. Modo público: query `["public-user", userId]`. Portada img 16:9 h-36 sm:h-44 ring-gold/30 o placeholder (gradiente + 4 AlqEmoji en gold/15-20 + marca de agua ALQEMIA tone mono). Avatar 2xl override h-20 w-20 ring-gold `-mt-10`. Nombre en `AlqemiaLetters` (h1 text-2xl, strokeWidth 8) + BadgeCheck azul + LevelBadge. "Miembro desde {mes año}" es. Bio con `AlqText` (hint "Cuéntale al gremio quién eres" en propio sin bio). Tarjeta "Resultados reportados" solo si reports>0 (Facturación compacta `$12,3 K` Intl es, Pedidos, ROAS x{avg}, Evidencias + timeAgo). Stats row Publicaciones/Comentarios/XP + LevelProgress. Logros con `FitText as="p" lines={2}` + `min-w-0` (fix desborde "Primera Transmutación"). Completitud + Editar perfil + Cerrar sesión solo en propio; "Volver" (ArrowLeft → onBack o history.back) en público. Skeleton y error con Reintentar. Aliados + Leaderboard solo en propio. |
| `src/components/alqemia/profile/edit-profile-dialog.tsx` | Sección "Portada" arriba del avatar: preview aspect-video max-h-32 (img o mini placeholder), "Cambiar portada" (file oculto → `compressImage` 16:9 maxWidth 1280 q0.82 con recompresión escalonada si >380KB), "Quitar" → `coverImage: null`. Bio: botón Sparkles "Emojis del gremio" → Popover con `AlqEmojiPicker`, inserta `[a:token]` en la posición del cursor del textarea (ref + setSelectionRange), contador `{n}/500`, vista previa live con `AlqText`, validación cliente de tokens inválidos (`hasInvalidAlqToken`). Al guardar incluye `coverImage` solo si cambió e invalida `["me"]` y `["public-user", userId]`. |
| `src/components/alqemia/profile/leaderboard.tsx` | BadgeCheck azul si `isVerifiedUser(entry)`; filas clicables (button + `onOpenProfile?.(entry.id)`); título en AlqemiaLetters. Sección final "Cómo se alcanza cada rango" (AlqemiaLetters): 8 filas de LEVELS (nombre font-semibold, "desde {min} XP", badge dorado + nota "Chulito azul verificado" en Gran Maestre/Leyenda, apiladas en móvil), lista "Cómo se gana XP" con valores reales (+15/+5/+25 bonus +50/+100/+25) y línea oro "Reportar resultados al publicar +25 XP — la evidencia es lo que hace destacar tu perfil". |
| `src/components/alqemia/app-shell.tsx` | Estado `publicUserId` + listener de `alqemia:open-profile` (CustomEvent<string> → setPublicUserId + setView("profile")). `go()` limpia publicUserId (todos los accesos al Perfil muestran el propio). Render `<ProfileView userId={publicUserId ?? undefined} onBack={publicUserId ? () => setPublicUserId(null) : undefined} />`. Nada más tocado. |

## Contrato para otros agentes

- **Abrir un perfil público desde cualquier componente:**
  `window.dispatchEvent(new CustomEvent("alqemia:open-profile", { detail: userId }))`
  AppShell lo escucha, cambia a la vista Perfil y muestra el perfil público con botón Volver. `openPublicProfile(id)` exportado desde `profile-view.tsx` como helper.
- El feed/muro puede usar ese evento en los avatares/nombres de los posts.

## Decisiones clave

1. **isVerifiedUser en profile.ts** como fuente única de la regla; APIs la aplican y la UI confía en `verified` serializado (con doble check cliente vía xp).
2. **Agregación con un único `db.post.aggregate`** (where `OR` métricas not null) — soportado por Prisma/SQLite, verificado con datos de prueba (2 posts: revenue 12300+7700=20000, orders 42+18=60, roas (3.4+2.6)/2=3, count excluye posts sin métricas).
3. **Miembros BLOCKED → 404 "Miembro no encontrado"** en perfil público (consistente con leaderboard que filtra ACTIVE).
4. **Modo propio también consulta `/api/users/me`** para tener contadores y resultados en mi perfil; identidad/editables siguen viniendo de useMe.
5. **XP_GUIDE hardcodeado en leaderboard.tsx** con comentario de sincronía: `@/lib/gamification` importa `db` (server-only) y no es importable desde cliente. Valores: 15/5/25(+50)/100/25 y reporte +25.
6. **Cover recompresión escalonada** (1280 q0.82 → q0.6 → 1024 q0.5 → 900 q0.42) para respetar el límite de 400KB del API; umbral seguro 380KB.
7. `AlqemiaLetters` se auto-encierra con `max-width:100%` (`.alq-letters`), pero títulos largos usan `text-base sm:text-lg` como margen extra en móvil.

## Pendiente / notas

- El valor **+25 XP por reportar resultados** aún lo debe añadir otro agente al motor (línea ya visible en la guía de XP del leaderboard).
- Tests funcionales hechos con curl (login admin + GET users/[id] + PATCH coverImage) y scripts temporales con Prisma; **todo dato de prueba fue eliminado** (posts de métricas de prueba borrados; cover de admin vuelve a null).
- `prisma generate` fue ejecutado solo para poder correr scripts de verificación locales (no afecta el schema).

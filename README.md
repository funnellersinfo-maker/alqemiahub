# ALQEMIA — Hub de Marketing & Ecommerce

Plataforma tipo Whop/Hotmart para la academia **ALQEMIA**: registro abierto para la comunidad, muro social de miembros, classroom con programas grabados, herramientas de crecimiento (Calculadora de Precios + CopyLab IA), gamificación con niveles de alquimia, ranking y panel de administración con clave.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4** + shadcn/ui (tema lujo: negro + oro `#D9A441`)
- **Prisma ORM** + SQLite (local) / Durable Object SQLite (producción)
- **NextAuth v4** (credenciales + Google OAuth opcional)
- **TanStack Query** + Zustand
- **z-ai-web-dev-sdk** (backend) para el CopyLab IA

## Puesta en marcha (desarrollo)

```bash
bun install
cp .env.example .env        # edita los valores
bun run db:push             # crea el esquema en SQLite
bun prisma/seed.ts          # contenido inicial: 12 perfiles, 6 programas, muro activo
bun run dev                 # http://localhost:3000
```

### Accesos del titular

- **Cuenta admin**: `admin@alqemia.com` · contraseña `AlqemiaAdmin2025!`
- **Panel admin**: tuerca en el menú → clave `ALQEMIA-ADMIN-2025` (configurable en `ADMIN_ACCESS_KEY`)
- Los perfiles de contenido inicial usan contraseñas aleatorias: no son cuentas de acceso
- Usuario suspendido (ejemplo de bloqueo visible en el panel): `carlos@alqemia.com`

> Tras clonar este repositorio, cambia la contraseña del admin y la clave del panel.

## Deploy en Cloudflare (producción)

La plataforma vive en dos Workers del mismo account:

| Recurso | URL | Rol |
| --- | --- | --- |
| **Enlace corto para compartir** | **https://alqemiahub.pages.dev** | Redirige (302) al hub — es el link oficial para comunidades |
| `alqemiahub` | https://alqemiahub.mastershop-funnellers.workers.dev | La app completa (Next.js 16 vía OpenNext) |
| `alqemia-db` | https://alqemia-db.mastershop-funnellers.workers.dev | Base de datos (Durable Object SQLite) — solo `/health` público |

El enlace corto vive en un proyecto de Cloudflare Pages (`alqemiahub`) cuyo único contenido es un redirect (`pages-redirect/_redirects`). Para cambiar su destino, edita ese archivo y vuelve a desplegar: `bunx wrangler pages deploy pages-redirect --project-name alqemiahub --branch main`.

### Dominio propio `alqemiahub.dev`

El dominio está **disponible** (verificado en el registro de Google). Para usar exactamente `https://alqemiahub.dev`:

1. Regístralo (~US$12/año) en Cloudflare (Dashboard → Domain Registration) o tu registrador preferido y añádelo a la cuenta de Cloudflare como zona.
2. Conéctalo al worker añadiendo a `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "alqemiahub.dev", "custom_domain": true }]
```

3. Actualiza la variable `NEXTAUTH_URL` en `wrangler.jsonc` a `https://alqemiahub.dev`, el destino en `pages-redirect/_redirects` y redespliega (`bunx opennextjs-cloudflare build && bunx wrangler deploy`).

Arquitectura de datos: `Prisma 6 (driverAdapters)` → `@prisma/adapter-d1` → shim `RemoteSqlDatabase` (`src/lib/cf-sql.ts`) → Durable Object `HubDB` (`db-worker/index.ts`) con SQLite real y auto-inicialización (esquema + datos iniciales incluidos en `db-worker/schema.sql` y `db-worker/seed.sql`).

### Redesplegar

```bash
bun install
# 1) Base de datos (solo si cambió el esquema o el contenido inicial)
cd db-worker && bunx wrangler deploy && cd ..
# 2) Aplicación
bunx opennextjs-cloudflare build
bunx wrangler deploy
```

Variables/secretos del worker `alqemiahub`:

- `NEXTAUTH_URL` (var) — URL pública
- `NEXTAUTH_SECRET` (secret) — firma de sesiones
- `ADMIN_ACCESS_KEY` (var) — clave del panel admin

El worker `alqemia-db` expone `POST /admin/reseed` (interno) para restaurar el contenido inicial; requiere `DB_ADMIN_KEY`.

> Nota: la herramienta CopyLab IA depende del SDK del entorno de desarrollo; en Cloudflare responde con un mensaje de no disponible. Todo lo demás (registro, login, muro, classroom, gamificación, admin, métricas) funciona 100% en producción.

### Acceso de miembros

Registro e ingreso únicamente con **email y contraseña** (abierto a cualquier visitante). Al crear la cuenta, el miembro entra directo al Ritual de Iniciación (quiz de perfil). El acceso social con Google/Microsoft se retiró deliberadamente; su implementación queda en el historial de git (commit `fda7849`) por si algún día se desea reactivar.

### Ritual de Iniciación (onboarding gamificado)

La creación de cuenta termina en un quiz de 5 preguntas (avatar → especialidades → objetivos → nivel → bio) con **% de perfil en vivo**: cada pieza vale 20% y el medidor sube con cada respuesta. Al completar: +100 XP, nivel, y celebración. El perfil del usuario muestra su % de completitud y qué falta para el 100% (editable desde el diálogo de perfil, incluido el nivel de experiencia).

## Estructura

```
src/
  app/
    page.tsx              # única ruta: Splash → Auth → Onboarding → Hub
    api/                  # auth, me, feed, posts, courses, lessons, leaderboard, admin, tools
  components/
    alqemia/              # auth, onboarding, feed (muro), classroom, tools, profile, admin
    ui/                   # shadcn/ui
  lib/                    # auth, db, gamificación (XP/niveles/logros), store, tipos
prisma/
  schema.prisma           # User, Post, Comment, Like, Course, Lesson, LessonProgress, Achievement
  seed.ts                 # contenido inicial completo
public/images/            # logo ALQEMIA, héroe y portadas de programas
```

## Gamificación

- **XP**: publicar (+15), comentar (+10), dar me gusta (+5), completar lección (+25), completar perfil (+100)
- **Niveles 1-8** con temática de alquimia: Aprendiz → Aprendiz Avanzado → Iniciado → Adepto → Alquimista → Maestre → Gran Maestre → Magnum Opus
- **Logros**: Perfil Transmutado, Primera Publicación, Voz del Gremio (comentarios), etc.
- **Ranking**: top 10 por XP con marcado "(tú)"

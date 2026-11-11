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

| Worker | URL | Rol |
| --- | --- | --- |
| `alqemiahub` | https://alqemiahub.mastershop-funnellers.workers.dev | La app completa (Next.js 16 vía OpenNext) |
| `alqemia-db` | https://alqemia-db.mastershop-funnellers.workers.dev | Base de datos (Durable Object SQLite) — solo `/health` público |

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

### OAuth de Google

El botón "Continuar con Google" solo aparece con `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` configurados (OAuth real). Sin esas variables, el registro y login son 100% por email y contraseña.

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

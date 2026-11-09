# ALQEMIA — Hub de Marketing & Ecommerce

Plataforma tipo Whop/Hotmart para la academia **ALQEMIA**: muro social de miembros, classroom con programas grabados, herramientas de crecimiento (Calculadora de Precios + CopyLab IA), gamificación con niveles de alquimia, ranking y panel de administración con clave.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4** + shadcn/ui (tema lujo: negro + oro `#D9A441`)
- **Prisma ORM** + SQLite
- **NextAuth v4** (credenciales + Google OAuth real opcional + modo demo)
- **TanStack Query** + Zustand
- **z-ai-web-dev-sdk** (backend) para el CopyLab IA

## Puesta en marcha (desarrollo)

```bash
bun install
cp .env.example .env        # edita los valores
bun run db:push             # crea el esquema en SQLite
bun prisma/seed.ts          # datos demo: 11 miembros, 6 programas, muro activo
bun run dev                 # http://localhost:3000
```

### Cuentas demo

- Miembro: `valeria@alqemia.com` · contraseña `alqemia123`
- Todos los miembros seed usan `alqemia123`
- Usuario suspendido (para probar el bloqueo): `carlos@alqemia.com`
- **Panel admin**: tuerca en el menú → clave `ALQEMIA-2025` (configurable en `ADMIN_ACCESS_KEY`)

### OAuth de Google

Sin `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` el botón "Continuar con Google" abre un **simulador** (cuentas demo instantáneas). Con las variables seteadas en `.env` se activa el OAuth real automáticamente.

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
  seed.ts                 # datos demo completos
public/images/            # logo ALQEMIA, héroe y portadas de programas
```

## Despliegue

### ⚠️ Antes de publicar

1. Genera un `NEXTAUTH_SECRET` real (`openssl rand -base64 32`)
2. Cambia `ADMIN_ACCESS_KEY` por una clave privada
3. Borra o adapta el seed de demo antes de producción (`bun prisma/seed.ts`)

### Vercel (camino más simple — recomendado)

1. Sube el repo a GitHub → "Import Project" en Vercel
2. Agrega las variables de entorno del `.env`
3. La BD SQLite local **no funciona en serverless**: migra a **Turso** o **Neon**:
   - Turso: `DATABASE_URL=libsql://...` con el driver adapter `@prisma/adapter-libsql`
   - O ejecuta la app en un VPS/contenedor donde SQLite en disco funcione

### Cloudflare Pages (dominio `*.pages.dev`)

Es viable, con estas adaptaciones:

1. **Runtime**: compila Next.js con `@opennextjs/cloudflare` (Workers) — `npx opennextjs-cloudflare build && npx wrangler deploy`
2. **Base de datos**: el archivo SQLite local no sobrevive en Workers (FS efímero). Usa **Cloudflare D1** (SQLite nativo) con `@prisma/adapter-d1`:
   - `wrangler d1 create alqemia-db`
   - Bind de `binding = "DB"` en `wrangler.toml`
   - `prisma generate` + `wrangler d1 migrations apply` con el SQL de Prisma (`prisma migrate diff`)
3. **Auth**: NextAuth funciona con edge runtime; define `NEXTAUTH_URL=https://TU-PROYECTO.pages.dev` y registra ese dominio en Google Cloud Console si activas OAuth real
4. **SDK de IA (CopyLab)**: activa `nodejs_compat = "v2"` en `wrangler.toml`; si el SDK da problemas en Workers, aísla el endpoint `/api/tools/copylab` en un servicio externo o Hosted Functions

**Veredicto**: el 100% de la UI/lógica es portable; el único cambio estructural es la capa de persistencia (SQLite → D1/Turso) y la compilación OpenNext. Estimado: unas 2-4 horas de adaptación + pruebas.

## Gamificación

- **XP**: publicar (+15), comentar (+10), dar me gusta (+5), completar lección (+25), completar perfil (+100)
- **Niveles 1-8** con temática de alquimia: Aprendiz → Aprendiz Avanzado → Iniciado → Adepto → Alquimista → Maestre → Gran Maestre → Magnum Opus
- **Logros**: Perfil Transmutado, Primera Publicación, Voz del Gremio (comentarios), etc.
- **Ranking**: top 10 por XP con marcado "(tú)"

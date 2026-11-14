# ALQEMIA — Hub de Marketing & Ecommerce

Plataforma tipo Whop/Hotmart para la academia **ALQEMIA**: registro **solo por invitación** (códigos únicos generados desde el panel admin y atados al correo del prospecto), educación gamificada en el registro (**El Códice**: XP, rangos y mapa), tour obligatorio de bienvenida (**El Mapa del Gremio**), muro social de miembros, classroom con programas grabados, El Arsenal de Herramientas por categorías (CopyLab de Élite, Calculadora de Precios, Whalink), El Oráculo con IA en vivo + búsqueda web, gamificación con niveles de alquimia, ranking y panel de administración con clave.

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
| **Enlace oficial (limpio)** | **https://alqemiahub.pages.dev** | Sirve TODO el Hub (portal inverso): la URL **nunca** cambia a workers.dev — link para comunidades |
| `alqemiahub` | https://alqemiahub.mastershop-funnellers.workers.dev | La app completa (Next.js 16 vía OpenNext) — dominio interno: visita directa → 308 al enlace oficial |
| `alqemia-db` | https://alqemia-db.mastershop-funnellers.workers.dev | Base de datos (Durable Object SQLite) — solo `/health` público |

El enlace oficial vive en un proyecto de Cloudflare Pages (`alqemiahub`) que actúa como **portal inverso** (`pages-portal/_worker.js`): sirve cada petición del Hub proxificada al worker, así la barra de direcciones permanece siempre en `pages.dev` (y evita bloqueos de operadores móviles que filtran `*.workers.dev`). El middleware `src/middleware.ts` redirige (308) cualquier visita directa al dominio interno hacia el enlace limpio, excepto las peticiones internas del portal (cabecera `x-alqemia-portal`), lo que impide bucles. `NEXTAUTH_URL` apunta a `https://alqemiahub.pages.dev`. Para cambiar el portal, edita `pages-portal/_worker.js` y vuelve a desplegar: `bunx wrangler pages deploy pages-portal --project-name alqemiahub --branch main`.

### Dominio propio `alqemiahub.dev`

El dominio está **disponible** (verificado en el registro de Google). Para usar exactamente `https://alqemiahub.dev`:

1. Regístralo (~US$12/año) en Cloudflare (Dashboard → Domain Registration) o tu registrador preferido y añádelo a la cuenta de Cloudflare como zona.
2. Conéctalo al worker añadiendo a `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "alqemiahub.dev", "custom_domain": true }]
```

3. Actualiza la variable `NEXTAUTH_URL` en `wrangler.jsonc`, los hosts en `pages-portal/_worker.js` y `src/middleware.ts`, y redespliega (`bunx opennextjs-cloudflare build && bunx wrangler deploy && bunx wrangler pages deploy pages-portal --project-name alqemiahub --branch main`).

Arquitectura de datos: `Prisma 6 (driverAdapters)` → `@prisma/adapter-d1` → shim `RemoteSqlDatabase` (`src/lib/cf-sql.ts`) → Durable Object `HubDB` (`db-worker/index.ts`) con SQLite real y auto-inicialización (esquema + datos iniciales incluidos en `db-worker/schema.sql` y `db-worker/seed.sql`).

### Redesplegar

```bash
bun install
# 1) Base de datos (solo si cambió el esquema o el contenido inicial)
cd db-worker && bunx wrangler deploy && cd ..
# 2) Aplicación
bunx opennextjs-cloudflare build
bunx wrangler deploy
# 3) Portal del enlace limpio (solo si cambió pages-portal/_worker.js)
bunx wrangler pages deploy pages-portal --project-name alqemiahub --branch main
```

Todas las operaciones usan `CLOUDFLARE_API_TOKEN` (token vigente del titular; rotable desde el dashboard de Cloudflare).

Variables/secretos del worker `alqemiahub`:

- `NEXTAUTH_URL` (var) — URL pública
- `NEXTAUTH_SECRET` (secret) — firma de sesiones
- `ADMIN_ACCESS_KEY` (var) — clave del panel admin

El worker `alqemia-db` expone `POST /admin/reseed` (interno) para restaurar el contenido inicial; requiere `DB_ADMIN_KEY`.

> Nota: la herramienta CopyLab IA depende del SDK del entorno de desarrollo; en Cloudflare responde con un mensaje de no disponible. Todo lo demás (registro, login, muro, classroom, gamificación, admin, métricas) funciona 100% en producción.

### Acceso de miembros (solo por invitación)

El registro **ya no es abierto**: cada nuevo miembro necesita un **código de invitación único** que el titular genera desde **Panel de Administración → Invitaciones**, ingresando **el correo con el que el prospecto se va a registrar**. En el registro, **correo y código deben coincidir** y un código sirve **una sola vez** (formato `ALQ-XXXX-XXXX`). El panel permite copiar, regenerar (si sigue pendiente) y eliminar invitaciones, y muestra el estado de cada una (Pendiente / Usado). Ingreso únicamente con **email y contraseña**. El acceso social con Google/Microsoft se retiró deliberadamente; su implementación queda en el historial de git (commit `fda7849`) por si algún día se desea reactivar.

### El Códice del Alquimista (educación en el registro)

Al sellar su invitación, el prospecto no entra directo: primero recibe **El Códice**, 4 lecciones gamificadas de 20 segundos que le enseñan **qué es el XP y cuánto vale cada acción** (+15 publicar, +5 comentar, +25 lección, +50 programa, +100 perfil), **los 8 rangos del gremio** (Aprendiz → Leyenda, con el ranking) y **el mapa del Hub** (las 7 salas). Al final, "Desbloquear mi acceso" dispara la animación **ACCESO CONCEDIDO** e inicia sesión automáticamente.

### Ritual de Iniciación (onboarding gamificado)

La creación de cuenta termina en un quiz de 5 preguntas (avatar → especialidades → objetivos → nivel → bio) con **% de perfil en vivo**: cada pieza vale 20% y el medidor sube con cada respuesta. Al completar: +100 XP, nivel, y celebración. El perfil del usuario muestra su % de completitud y qué falta para el 100% (editable desde el diálogo de perfil, incluido el nivel de experiencia).

### El Mapa del Gremio (tour obligatorio de primera apertura)

La primera vez que un miembro abre el Hub, **El Mapa del Gremio** lo recibe: burbujas emergentes que lo llevan **sección por sección** (Muro → En Vivo → Classroom → Marketplace → Herramientas → El Oráculo → Perfil) con un **foco dorado** que ilumina el ítem real del menú mientras la sección se muestra detrás. Cada burbuja explica qué encontrará ahí y **exige presionar Continuar** para avanzar y desbloquear; no se puede saltar ni cerrar. Al completar el recorrido: **+25 XP y el logro "Mapa Descifrado"**, y el miembro queda libre en su plataforma (solo se muestra una vez, persistido en `User.tourCompletedAt`; los miembros existentes antes del deploy quedan exentos).

### App instalable (PWA)

La plataforma se instala como app real: en **PC/Android** aparece el banner "Instalar app" (queda anclada al escritorio/barra de tareas/launcher con su ícono dorado) y en **iPhone** la tarjeta muestra los pasos (Compartir → Añadir a pantalla de inicio). Incluye `manifest.webmanifest`, service worker con caché offline del shell e íconos maskable. Los atajos del ícono (long-press / right-click): El Oráculo, Marketplace y En Vivo.

### En Vivo (transmisiones)

Sección con **punto rojo titilante** en el menú cuando hay transmisión activa. Desde el Panel de Administración → En Vivo, el titular programa lives con **imagen de anuncio 16:9**, reseña, fecha y link; al pulsar "Activar EN VIVO" el punto rojo enciende para toda la comunidad (reproductor grande embebido). Al finalizar, se guarda el link de la **grabación** y queda listada en la sección. Transmite con YouTube Live (gratis, se incrusta) o Meet/Zoom (botón "Unirse"). Sin live: "Próximamente" con la imagen, la fecha y un contador.

### Marketplace (con aliados y comprobantes)

Mercado interno con 4 categorías: **Micro Apps, Productos Digitales, Productos Físicos y Servicios**. Cualquier miembro publica (precio, comisión % para aliados, recurrente, portada 16:9, link al material en Drive/Notion — visible solo para el creador y sus aliados). Otros lo agregan a **Mis Aliados** y lo revenden: registran la venta con **comprobante de pago** (imagen), queda pendiente y el creador la confirma desde su perfil. En **Perfil → Mis Aliados** cada miembro ve su negocio: comisiones ganadas, quién revende sus productos, cuánto vende y gana cada aliado, y la conversión (ventas/vistas) de cada producto. Sin pasarelas de pago: cobro por medios locales con comprobante adjunto.

### El Oráculo (asistente IA) y CopyLab

Chat IA tipo ChatGPT **fluido tipo WhatsApp**: tu mensaje sale al instante (eco optimista) y la respuesta llega **palabra por palabra en vivo** (streaming NDJSON sobre Workers AI en producción / SDK local en dev), con cursor dorado mientras escribe. Multi-turno con historial persistente por miembro (límite razonable de 60 mensajes/día) y **fecha de hoy** en el contexto del modelo. En **producción** corre sobre **Cloudflare Workers AI** (binding `AI`, capa gratuita, sin API keys) con Llama 3.3 70B.

**Toggle "Internet"**: cuando lo activas, El Oráculo **busca en la web antes de responder** (cadena multi-entorno: SDK local → Bing RSS → DuckDuckGo, todo sin API keys), te muestra las fuentes como chips enlazables y el modelo cita los links en una sección "Fuentes".

**CopyLab de Élite** (mismo motor IA): 3 variantes con los más altos estándares de copywriting — frameworks **AIDA · PAS · PASTOR**, selector de **nivel de conciencia de Eugene Schwartz** (5 niveles + automático), cada variante lista con sus **gatillos mentales/sesgos** usados y el **"por qué convierte"** (la psicología explicada en una frase).

### Whalink (en Herramientas → Clientes & Contacto)

Generador de enlaces de WhatsApp: número con código de país + mensaje precargado → link `wa.me` corto copiable + **QR HD 1024px con el logo de ALQEMIA al centro** (corrección de errores H, verificable al escaneo). Descargable y regenerable las veces que sea.

### El Arsenal (Herramientas)

La sección Herramientas abre con una bienvenida elegante — **El Arsenal de ALQEMIA** — y organiza todo por categorías en submenú: **Copys & Persuasión** (CopyLab de Élite + próximamente Creativos y Plantillas), **Precios & Estrategia** (Calculadora de Precios + próximamente KPIs y Competencia) y **Clientes & Contacto** (Whalink). Nada de herramientas sueltas: cada categoría se abre y se vuelve con un clic.

## Estructura

```
src/
  app/
    page.tsx              # única ruta: Splash → Auth → Onboarding → Hub
    api/                  # auth, me, feed, posts, courses, lessons, leaderboard, live, marketplace, ai/chat, admin, tools
  components/
    alqemia/              # auth, onboarding, feed (muro), live, classroom, marketplace, tools, ai (oráculo), profile, admin
    pwa/                  # service worker + banner de instalación
    ui/                   # shadcn/ui
  lib/                    # auth, db, ai (motor IA), gamificación (XP/niveles/logros), store, tipos
prisma/
  schema.prisma           # User, Post, Comment, Like, Course, Lesson, LessonProgress, Achievement, LiveSession, Product, ProductFavorite, Sale, ChatMessage
  seed.ts                 # contenido inicial completo
public/                   # manifest.webmanifest, sw.js, íconos PWA, imágenes
```

## Gamificación

- **XP**: publicar (+15), comentar (+10), dar me gusta (+5), completar lección (+25), completar perfil (+100)
- **Niveles 1-8** con temática de alquimia: Aprendiz → Aprendiz Avanzado → Iniciado → Adepto → Alquimista → Maestre → Gran Maestre → Magnum Opus
- **Logros**: Perfil Transmutado, Primera Publicación, Voz del Gremio (comentarios), etc.
- **Ranking**: top 10 por XP con marcado "(tú)"

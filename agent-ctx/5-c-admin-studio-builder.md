# Task 5-c — Admin Panel: "El Estudio" (StudioManager) + "Ajustes" (AdminSettings) + shared admin-fetch

Agent: admin-studio-builder (Z.ai Code)
Project: ALQEMIA HUB — /home/z/my-project (Next.js 16 App Router + TS + Tailwind 4 + shadcn/ui + TanStack Query)

## What was built

### 1. CREATED `src/components/alqemia/admin/admin-fetch.ts`
Shared helper extracted 1:1 from admin-view.tsx:
- `export async function adminFetch<T>(url, init?)` — reads `alqemia-admin-key` from localStorage, sends `x-admin-key` header, on 401 calls `useAppStore.getState().setAdminUnlocked(false)` and throws `Error("Sesión de admin cerrada")`, other !ok → `Error(json.error ?? "Error inesperado")`.
- `export function isLockedError(err)` — checks message includes "admin cerrada".

### 2. EDITED `src/components/alqemia/admin/admin-view.tsx`
- Removed the local `adminFetch`/`isLockedError` definitions (kept `AdminPost` type); now imports from `./admin-fetch` (via `@/` alias, same convention as other imports). Behavior identical.
- Added two Tabs: triggers `Estudio` (value `estudio`) and `Ajustes` (value `ajustes`) right after "En Vivo" in TabsList; contents `<StudioManager />` / `<AdminSettings />` at the end.
- NOTE per task scope: `invites-manager.tsx` and `live-manager.tsx` still define their own local `adminFetch` copies (left untouched intentionally).

### 3. CREATED `src/components/alqemia/admin/studio-manager.tsx`
`export function StudioManager()` — YouTube-Studio-like manager, `grid gap-4 lg:grid-cols-[340px_1fr]`:
- LEFT: Card "Programas" + count Badge + gold "Nuevo" (Plus, size sm); scrollable list `max-h-[70vh] overflow-y-auto thin-scrollbar` of `CourseRow`s: 16:9 w-20 cover thumb (`/`-path or dataURL → img), title truncate, "{n} lecciones · {level}", ChevronUp/ChevronDown arrows (PATCH order swap with neighbor by index → invalidate `["admin-courses"]`). Selected row = `border-gold bg-gold/10`.
- RIGHT: `CourseEditor` (keyed by course id / "new" so state resets) or EmptyState (Clapperboard icon).
  - Form: cover preview `aspect-video max-h-44 rounded-xl` + hidden file input (accept image/*) → reuses `compressImage` from `@/lib/image-utils` with `{ maxWidth: 800, aspect: 16/9, quality: 0.82 }` → blocks + toast if estimated > 400 KB (base64 payload * 3/4); title Input (3-120), description Textarea, level Select (Principiante/Intermedio/Avanzado), order number Input.
  - Edit mode: "Guardar cambios" (gold, PATCH with only changed fields, toast "Programa actualizado") + "Eliminar programa" (destructive outline, AlertDialog warns "Se eliminarán sus lecciones y el progreso de los miembros", DELETE → invalidate → clear selection). `toast.info("No hay cambios que guardar")` if diff empty.
  - Create mode: empty form, level "Principiante", cover null → POST sends `/images/courses/ecommerce.png` fallback, order defaults to last+1; awaits invalidate then auto-selects created course by returned id.
  - LessonsSection (saved courses only): "Lecciones" h4 + count + gold "Añadir lección"; rows with position number, title, duration ("X min"), Video (gold) / VideoOff (ghost) indicator, up/down reorder (index-swap PATCH), Pencil → LessonDialog, Trash2 → AlertDialog delete.
  - `LessonDialog` (create+edit shared): title*, description, videoUrl (placeholder "https://youtube.com/watch?v=… o https://…/video.mp4", hint "YouTube, Vimeo o MP4 directo"), durationMin 1-600; POST `/api/admin/lessons` or PATCH `/api/admin/lessons/{id}` (empty videoUrl → null clears); resets form on open.
- Data: `useQuery ["admin-courses"]`; loading skeletons; error → QueryErrorView retry; locked → LockedNotice ("Desbloquear panel" → `useAppStore.getState().setAdminGateOpen(true)`). Local copies of LockedNotice/QueryErrorView (admin-view does not export them; importing from admin-view would be circular).

### 4. CREATED `src/components/alqemia/admin/admin-settings.tsx`
`export function AdminSettings()` — `useQuery ["admin-settings"]`:
- Section "Vídeo del Muro" (PlayCircle): explanation text, URL Input (synced from `muro_video` setting via useEffect), "Guardar" (validates `^https?://`, PUT `{key:"muro_video"}`, toast "Vídeo del muro actualizado", invalidates `["admin-settings"]` + `["muro-video"]` so the feed MuroVideo refreshes), "Quitar vídeo" (DELETE `?key=muro_video`, toast). Live preview: YouTube watch/youtu.be/embed/shorts → 16:9 iframe embed; .mp4/.webm → `<video controls>`; else gold link.
- Section "La Gran Purga" (danger, `border-red-500/40`, Trash2 red): warning copy, destructive button → AlertDialog with double warning (description + red "Acción irreversible" callout) → POST `/api/admin/purge` → toast `Eliminados X miembros y Y publicaciones` → invalidates `["admin-stats"]`, `["admin-users"]`, `["admin-courses"]`, `["feed"]`, `["leaderboard"]`.

## Verification
- `bunx eslint` on the 4 files: 0 errors, 0 warnings (removed an unused eslint-disable for jsx-a11y/media-has-caption — rule not enabled here).
- `bunx tsc --noEmit`: 0 errors in all alqemia/admin files. Had to annotate LessonDialog `mutationFn` return as `Promise<{ ok: boolean } | { lesson: { id: string } }>` (TanStack infers TData from first branch).
- dev.log: transient "Module not found admin-settings" while files were being written mid-edit; afterwards full page compiled and served `GET / 200` repeatedly.

## Notes for future agents
- Pre-existing tsc errors exist elsewhere (src/lib/gamification.ts `getDisplayLevel` missing, lib/db.ts DurableObject types, api/posts comments FeedComment role, codes-view) — NOT from this task, left as-is.
- Backend contract consumed (already built): /api/admin/courses (+[id]), /api/admin/lessons (+[id]), /api/admin/settings (GET/PUT/DELETE ?key=), /api/admin/purge.
- Conventions: dark zinc-950 + gold (`btn-gold`, `text-gold`, `bg-gold/10`), red-500/600 for danger, Spanish UI, lucide icons, relative fetch paths, `thin-scrollbar` utility for scrollable lists.

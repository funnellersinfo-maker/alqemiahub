# Task 5-a — El Grimorio (CodesView) — Work Record

## File created
- `src/components/alqemia/codes/codes-view.tsx` (only file, as required) — named export `CodesView`, `"use client"`.

## What was built
GitHub-like repository section "El Grimorio" for the ALQEMIA HUB (app-shell renders it for view "codes"). Consumes the existing `/api/codes*` backend exactly per contract (GET list, POST create, GET detail, PATCH, DELETE, POST fork) — no backend changes.

### Component structure (all inside the single file)
- `CodesView` (exported): header with `<AlqemiaLetters text="El Grimorio" strokeWidth={8} />`, subtitle, gold "Nuevo código" button (FilePlus2); local shadcn Tabs "Mis códigos" (isMine) / "Explorar" (!isMine, others' PUBLIC codes); grid `grid-cols-1 sm:grid-cols-2` of repo cards; inline full-page detail state via `selectedId`; shared create/edit dialog; `window.scrollTo` on detail open.
- `CodeCard`: clickable card (real `<button>` wrapper for a11y), fileName mono gold-bright + language dot + label, title, description line-clamp-2, visibility badge (gold Público / zinc Privado), "bifurcado de X" note, footer with UserAvatar sm + owner + `timeAgo` + forksCount (if > 0), hover `border-gold/40`.
- `CodeDetailView`: back button "Volver al grimorio", header (fileName mono + badge + owner + updatedAt + fork info), action row (Copiar via navigator.clipboard, Descargar via Blob/a.click(), "Usar este código" fork button when !isMine, Editar/Eliminar when isMine), code viewer with header bar (dot + fileName + language label + line count) and `<pre><code>` with sticky-left line-number gutter (select-none, bg-zinc-900), `max-h-[65vh] overflow-auto`, description below, AlertDialog delete confirm.
- `CodeFormDialog` + `CodeForm`: shared form for create/edit (Título*, Archivo, Lenguaje Select from CODE_LANGUAGES, Visibilidad as radio-like gold buttons, Descripción 500 max, Etiquetas, Código* mono textarea min-h-240 spellCheck=false). `CodeForm` initializes state from `editing` via `useState` initializer + `key={editing?.id ?? "nuevo"}` remount (no effects — passes `react-hooks/set-state-in-effect`).

### Data layer
- `useQuery(["codes"])` for the list; `useQuery(["codes", id])` (enabled when detail open) for content; mutations: create/PATCH, fork, DELETE — all invalidate `["codes"]` (prefix covers detail), parse `{ error }` JSON on non-OK and `toast.error` it. All fetch paths relative. Spanish toasts per spec ("Código guardado en el grimorio", "Código copiado", "Descargado", "Código bifurcado a tu grimorio", "Código eliminado del grimorio").
- Loading → 4 Skeleton cards; error → EmptyState with Reintentar; empty states per tab (FolderGit2 for "Mis códigos" with CTA, GitFork for "Explorar").
- UX touches: after create or fork, tab auto-switches to "Mis códigos" so the result is visible; after edit-save the detail refetches in place.

## Verification
- `bunx eslint src/components/alqemia/codes/codes-view.tsx` → exit 0, 0 problems (fixed one `react-hooks/set-state-in-effect` error by replacing the form-reset useEffect with a keyed remount pattern; fixed 3 TS18048 by using arrow-const closures after the null guard).
- `bunx tsc --noEmit` → no errors in codes-view.tsx.
- Dev server log: page compiles and serves 200 with the codes-view import resolved. NOTE for other agents: dev.log shows a pre-existing module-not-found in `admin-view.tsx` (missing `@/components/alqemia/admin/admin-settings`) — unrelated to this task, not touched.

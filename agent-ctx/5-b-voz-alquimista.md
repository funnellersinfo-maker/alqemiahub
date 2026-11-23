# 5-b — LA VOZ DEL ALQUIMISTA (generador de voz IA, El Arsenal)

Task ID: **5-b** · Estado: **completado** · `bunx eslint` sin errores en los 2 archivos · `tsc --noEmit` sin errores en los 2 archivos (errores restantes del repo son preexistentes y ajenos a esta tarea).

## Archivos creados / modificados

| Archivo | Cambio |
|---|---|
| `src/components/alqemia/tools/voice-tool.tsx` | **CREADO**. `export function VoiceTool()`. Card `rounded-2xl border-zinc-800 bg-zinc-950 p-5 sm:p-6` con header (Mic en chip dorado, título "Voz del Alquimista" text-lg, desc "Escribe el texto, elige la voz y descarga tu audio en MP3. 100% gratuito."). Textarea + contador `X / {maxChars}` debajo (google 3000 / casa 1024; si `text.length > maxChars` → contador en `text-red-400` y generate deshabilitado). Picker de voces en contenedor `thin-scrollbar max-h-56 overflow-y-auto rounded-xl border border-zinc-800 p-3` con grupos "Motor Google · Gratis" y "Voces de la casa · Premium" (`TTS_VOICES` filtrado por engine), grid `grid-cols-2 sm:grid-cols-3`, chips seleccionables con flag (badge uppercase), label, desc truncate; selected `border-gold bg-gold/10 text-gold-bright`, unselected `border-zinc-800 text-zinc-300 hover:border-gold/40`; default `voiceId = "es"`. Slider 0.5–2.0 step 0.1 default 1.0 con chip `x{speed.toFixed(1)}` SOLO cuando engine casa (google → nota "El control de velocidad está disponible en las voces de la casa"). Botón `btn-gold h-11 w-full sm:w-auto` con AudioLines / Loader2 + isPending. Handler `generate()`: POST relativo `/api/tools/tts` `{ text: text.trim(), voice: voiceId, speed: isCasa ? speed : 1 }` → si `!res.ok` parsea `{error}` y `toast.error`; si ok `res.blob()` → `URL.createObjectURL` (revoca URL anterior vía `audioUrlRef`) → `setAudio({ url, engine })`. Panel resultado `animate-view` (clase global existente) con `<audio controls>`, botón Descargar MP3/WAV (`Button asChild` + `<a download="voz-alqemia.wav|mp3">`) y "Limpiar" (revoca + reset). Nota Info inferior sobre clonación de voz / motores gratuitos. Estado 100% local (useState + useRef + useEffect cleanup). |
| `src/components/alqemia/tools/tools-view.tsx` | **EDITADO**. (1) Import `AudioLines` en lucide + `import { VoiceTool } from "@/components/alqemia/tools/voice-tool"`. (2) `CategoryKey` ahora incluye `"voice"`. (3) Nueva categoría en `CATEGORIES` después de "strategy" y antes de "contact": `{ key: "voice", title: "Voz & Audio", desc: "Convierte texto en voz humana con IA: elige entre 20+ voces y descarga el audio.", icon: AudioLines, tools: ["Voz del Alquimista"], soonCount: 0 }`. (4) `LOCKED_BY_CATEGORY.voice = []` (sin herramientas bloqueadas). (5) `CategoryView` renderiza `{category.key === "voice" && <VoiceTool />}`. (6) Comentario de cabecera y texto del hero de bienvenida actualizados para mencionar voz. |

## Contrato para otros agentes

- `VoiceTool` es autocontenida (sin props) y ya está integrada en El Arsenal → categorías → "Voz & Audio".
- Backend NO tocado (ya existía `src/app/api/tools/tts/route.ts`): espera `{ text, voice, speed }`, devuelve binario `audio/mpeg` (google, ≤3000 chars) o `audio/wav` (casa, ≤1024 chars, speed 0.5–2.0), errores como `{ error }`.
- La extensión del archivo descargado se decide con el **engine almacenado al momento de generar** (`audio.engine`), no con la voz actualmente seleccionada, para que cambiar de voz tras generar no corrompa la descarga.

## Decisiones clave

1. **Ref para el blob URL** (`audioUrlRef`) en vez de depender del estado: permite revocar el URL anterior al regenerar, al pulsar "Limpiar" y al desmontar el componente (cleanup en `useEffect`) sin efectos secundarios dentro de un updater de setState.
2. **`speed: isCasa ? speed : 1`** al enviar el body: el motor google ignora la velocidad; enviar siempre 1 para google es defensivo y sigue cumpliendo el contrato `{ text, voice, speed }`.
3. Botón "Generar voz" deshabilitado si texto vacío, `overLimit` o pending; el límite es dinámico según engine de la voz seleccionada (al cambiar de google → casa con texto largo, el contador se pone rojo y bloquea el botón automáticamente).
4. Descarga como `<a download>` dentro de `Button asChild variant="outline"` con estilos oro (`border-gold/40 text-gold-bright hover:bg-gold/10`), etiqueta dinámica "Descargar MP3" / "Descargar WAV".
5. Reutilización de utilidades del tema: `.btn-gold`, `.animate-view`, `.thin-scrollbar` (definidas en `globals.css`), sin colores blue/indigo, español, sin emojis, sin dependencias nuevas, fetch con ruta relativa.

## Pendiente / notas

- `dev.log` muestra `GET / 500` por `Module not found: '@/components/alqemia/codes/codes-view'` en `app-shell.tsx` — **preexistente y ajeno a esta tarea** (lo construye otro agente en paralelo; la carpeta `codes/` aún no existe). No se creó ningún stub para no pisar el trabajo del otro agente.
- Errores de `tsc` listados en el repo (gamification, db-worker, examples, etc.) también son preexistentes; ninguno en `voice-tool.tsx` ni `tools-view.tsx`.

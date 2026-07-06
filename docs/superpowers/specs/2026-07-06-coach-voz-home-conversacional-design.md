# Coach con voz + home conversacional + formulario adaptativo — Design Spec

**Fecha:** 2026-07-06
**Estado:** aprobado en brainstorming, pendiente de plan de implementación

## Resumen

La pestaña «Hoy» (☀️) se convierte en una conversación con el Coach IA. El usuario
puede enviar audio; se transcribe con Whisper (Groq) y el coach propone acciones
estructuradas (registrar/editar/borrar sesión, ajustar el plan) que el usuario
confirma con un tap. El formulario de registro se rehace como formulario adaptativo
por deporte. El plan de entrenamiento pasa de constante en código a la BD para que
el coach pueda modificarlo. Todo sin cambiar el modelo de seguridad actual
(JWT + RLS en cada escritura; el servidor no tiene `service_role`).

Plataforma objetivo: **web** (deploy de Vercel). La grabación nativa queda fuera de
alcance, pero las interfaces se diseñan para añadirla después.

## Decisiones tomadas (con el usuario)

- Un único spec para todo el trabajo (arquitectura + visual + entrada de datos + coach voz).
- Plataforma principal: web (`training-app-delta-self.vercel.app`).
- El coach **propone y el usuario confirma** con un tap (nunca actúa directo).
- Acciones del coach: registrar sesión, editar/borrar sesión, ajustar plan semanal,
  y responder como chat normal cuando no hay acción.
- Entrada manual: el problema es que faltan métricas por deporte → formulario
  adaptativo con selección de subtipo (tirada larga, series, carrera, técnica...).
- Layout home: **opción C** (conversación con tarjetas de acción), pestaña «Hoy» con sol.
- Alcance visual del resto de la app: pulido coherente, sin identidad nueva.
- Enfoque técnico: **A — agente en servidor (tool-calling), escrituras en cliente con RLS**.

## 1 · Datos (Supabase)

### `training_sessions` — nuevas columnas

- `subtype text` — subtipo de sesión: `easy | long_run | intervals | threshold |
  race | swim_technique | swim_sets | strength | hyrox_circuit | recovery`.
- `metrics jsonb` — métricas específicas del deporte:
  - Running: `{ distancia_km, ritmo_min_km, fc_media?, fc_max? }`
  - Natación: `{ metros, series?: [{ reps, distancia_m, descripcion? }] }`
  - Gym/Hyrox: `{ ejercicios: [{ nombre, series, reps, kg? }] }`

Lo común (duración, RPE, fatiga, notas) sigue en columnas planas para poder
consultarse y graficarse sin tocar el jsonb. RLS sin cambios.

### Plan editable

- Se usa la tabla existente `training_plans` (`plan_data jsonb` con `WeekPlan[]`).
- Primer arranque: si el usuario no tiene plan, se siembra desde
  `constants/trainingPlan.ts` (que pasa a ser solo semilla/fallback).
- `PlanContext` lee de la BD; si no hay fila ni conexión, cae a la constante.
- Los ajustes del coach (`adjust_plan`) mutan `plan_data` desde el cliente con el
  JWT del usuario.

### Migración

Archivo `supabase/migrations/2026-07-06-coach-voz.sql` con los `ALTER TABLE`
(idempotentes, `IF NOT EXISTS`) + actualización de `supabase/schema.sql`.

## 2 · Servidor (Vercel `api/`)

Mismo patrón de seguridad que `api/chat.ts`: validar JWT de Supabase → leer la key
BYOK de `user_ai_keys` con el JWT del usuario (RLS) → llamar a Groq. El servidor
nunca escribe en la BD y no tiene `service_role`.

### `/api/transcribe` (nuevo)

- POST con audio (multipart o base64), formato webm/opus del MediaRecorder.
- Llama a Groq `audio/transcriptions` con `whisper-large-v3`, idioma `es`.
- Devuelve `{ text }`. Errores: `NO_GROQ_KEY`, audio demasiado largo (límite ~2 min
  / ~10 MB), fallo de Groq (propaga status).

### `/api/coach` (nuevo)

- POST `{ messages }` como el chat, pero con `tools` definidas para
  `log_session`, `edit_session`, `delete_session`, `adjust_plan`.
- Modelo `llama-3.3-70b-versatile` (soporta tool use en Groq).
- Respuesta: `{ kind: 'text', content }` o `{ kind: 'proposal', action, args }`.
- Los `args` de cada tool se validan en servidor (validadores TS a mano, sin
  dependencias nuevas); si no validan → se degrada a respuesta de texto.
- `api/chat.ts` actual queda como está (lo usa la pestaña Chat).

## 3 · Cliente — home conversacional («Hoy» ☀️)

- **Saludo contextual local**: plantilla determinista con datos del plan del día,
  semana/fase y último registro. Sin llamada a la IA al abrir (instantáneo, gratis).
- **Chips de acción**: 🎙 Contar por voz · ✍️ Registrar · 📋 Ver plan.
- **Flujo de voz**: grabar (MediaRecorder) → `/api/transcribe` → el texto aparece
  como mensaje propio en el hilo → `/api/coach` → respuesta de texto o **tarjeta de
  propuesta** con Confirmar / Editar.
- **Confirmar** ejecuta la acción desde el cliente con la sesión del usuario
  (supabase-js + RLS) y refresca los hooks. **Editar** abre el formulario adaptativo
  pre-relleno con los args de la propuesta.
- El hilo del día se persiste en `ai_conversations` (modelo actual de conversaciones).
- La pestaña conserva nombre «Hoy» e icono de sol.

### Módulos nuevos

- `lib/coach/actions.ts` — tipos `ActionProposal` y ejecutores (una función por
  acción, escriben vía supabase-js).
- `lib/coach/greeting.ts` — saludo contextual determinista.
- `hooks/useRecorder.ts` — wrapper de MediaRecorder (interfaz preparada para una
  implementación nativa futura con expo-audio).
- `components/coach/` — `MessageBubble`, `ProposalCard`, `CoachInput` (texto + micro),
  `ActionChips`.

## 4 · Formulario adaptativo (registro manual y edición)

Reforma de `app/log/[day].tsx`:

1. Selector de **subtipo** de sesión (los del enum de §1, filtrados por el deporte
   del día, pero cambiables).
2. Campos según deporte:
   - Running: distancia, ritmo (autocalculado desde duración+distancia, editable), FC media/máx.
   - Natación: metros totales, series (repetición × distancia + descripción).
   - Gym/Hyrox: checklist de ejercicios existente + kg reales por ejercicio.
3. Comunes siempre: duración, RPE, fatiga, notas.
4. Modo edición: acepta una propuesta del coach o un registro existente y pre-rellena.

Componentes por deporte en `components/training/MetricFields/`.

## 5 · Arquitectura y refactor

- Trocear pantallas grandes (`chat/[id].tsx` 485 líneas, `log/[day].tsx` 464,
  `hoy.tsx` 424) extrayendo componentes reutilizables a `components/`.
- `constants/trainingPlan.ts` pasa a semilla; `PlanContext` es la fuente de verdad.
- Auth, Turnstile y `api/chat.ts` no se tocan.
- Sin dependencias nuevas de servidor; en cliente ninguna (MediaRecorder es API del navegador).

## 6 · Pulido visual coherente

Misma estética (dark Apple + temas white/nude vía `useTheme`), elevada:

- Puntos/segmentos de progreso semanal en la home y en Semana.
- Tarjetas más ricas (métricas del deporte visibles en Historial).
- Gráficas de Historial más cuidadas (grid tenue, punto final destacado, tabular-nums).
- Espaciados y jerarquía tipográfica consistentes con `constants/spacing.ts` y
  `typography.ts`.

Sin identidad visual nueva; los tres temas siguen funcionando.

## 7 · Errores

- Transcripción fallida → botón reintentar sin perder el audio grabado.
- Tool-call malformado → el coach responde en texto normal (nunca tarjeta rota).
- Sin key de Groq → mensaje con enlace a Ajustes (patrón `NO_GROQ_KEY` actual).
- Audio > límite → aviso antes de enviar.
- Escritura en Supabase fallida al confirmar → la tarjeta muestra el error y
  permite reintentar; el hilo no pierde la propuesta.

## 8 · Verificación

- `tsc --noEmit` limpio.
- E2E manual en el deploy web: grabar audio real → ver transcripción → confirmar
  propuesta → verificar el registro en Historial y en la BD.
- Probar los tres temas en la home nueva.
- Verificar que un usuario sin key de Groq recibe el CTA de Ajustes.
- Verificar RLS: las escrituras del coach solo afectan al usuario autenticado.

## Fuera de alcance

- Grabación de audio en nativo (expo-audio) — la interfaz de `useRecorder` queda preparada.
- Cambios en auth/Turnstile.
- Integración Garmin (.FIT/.TCX) — decisión previa, sigue pausada.

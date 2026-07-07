# Editor adaptativo + Agenda (carreras y eventos) + paquete premium — Diseño

**Fecha:** 2026-07-07
**Estado:** aprobado por el usuario (mockups en `.superpowers/` / artifact de la sesión)

## Problema

1. **Inconsistencia por deporte:** el editor del plan (`app/plan/[day].tsx`) usa la plantilla
   genérica `ExerciseTemplate` y pinta los 6 campos fijos (Series, Reps, **Carga**, Distancia,
   Duración, Descanso) para todos los deportes. Una sesión de natación pide "Carga: 40kg".
   El formulario de *registro* (`app/log/[day].tsx`) ya es adaptativo (`SwimFields`,
   `GymFields`, `RunningFields`); el editor del plan nunca se actualizó.
2. **UX de edición pobre:** formulario largo, todo teclado, sin desplegables ni atajos.
3. **Faltan piezas premium:** no hay calendario, ni gestión de competiciones, ni
   micro-interacciones (animaciones, hápticos, celebraciones).

## Decisiones tomadas con el usuario

- Editor: **acordeón con resumen** (opción B). Chips y steppers como atajos que *rellenan*
  el campo; la entrada manual siempre disponible.
- Competiciones: alcance completo — ficha + cuenta atrás, resultados post-carrera,
  vinculación con las fases del plan y análisis del coach IA.
- Navegación: pestaña nueva **«Agenda»** (5 tabs: Hoy, Semana, Agenda, Chat, Historial).
  Arriba la carrera objetivo (estilo opción C); debajo un **calendario mensual solo con
  eventos manuales** — los entrenamientos NO aparecen en él.

---

## 1. Editor de sesión adaptativo (`app/plan/[day].tsx`)

### Selección de tipo

Se sustituyen los 10 chips por dos niveles:

- **Segmentado de deporte:** 🏃 Run · 🏊 Swim · 🏋️ Gym · ⚡ Hyrox · 😌 Descanso
- **Desplegable de variante** (solo si el deporte tiene más de una):
  - Run → Suave (`running_easy`), Umbral (`running_threshold`), Tirada larga
    (`running_long`), Intervalos (`running_intervals`)
  - Swim → única (`swimming`); el desplegable no se muestra
  - Gym → Fuerza (`gym_strength`), Circuito Hyrox (`gym_hyrox`)
  - Hyrox → única (`hyrox_simulation`)
  - Descanso → Descanso (`rest`), Recuperación activa (`active_recovery`)

Cambiar deporte o variante sigue cargando la plantilla `SESSION_DEFAULTS` correspondiente,
con confirmación si ya había ejercicios editados (hoy machaca sin avisar).

### Campos por deporte en cada ejercicio

Se reutiliza `ExerciseTemplate` (el plan vive en jsonb → **sin migración**). Solo cambia qué
campos se muestran y con qué etiqueta:

| Deporte | Campos visibles | Ocultos |
|---|---|---|
| Swim | Series (nº) × Distancia (m), Descanso, Estilo/foco (chips → `notes`) | Carga, Duración |
| Gym | Series, Reps, Carga (kg), Descanso, Notas | Distancia, Duración |
| Run | Series (nº) × Distancia, Ritmo objetivo (`notes`), Duración, Descanso | Carga |
| Hyrox | Todos (necesita carga + distancia) | — |
| Descanso | Nombre, Duración, Notas | resto |

### Interacción

- **Acordeón:** cada ejercicio colapsado muestra nombre + resumen legible generado
  («8×100 m · desc 30 s», «4×8 · 40 kg»). Uno abierto a la vez; abrir/cerrar animado
  (Reanimated `LayoutAnimation`/`withSpring`), chevron rotando.
- **Steppers** (− / +) en numéricos (series, distancia en swim con paso 25 m); el valor
  central es un `TextInput` editable.
- **Chips de atajo** bajo campos de texto frecuentes (descanso: 15 s/30 s/45 s/1 min;
  estilo: Crol/Espalda/Pull/Técnica). Tocar un chip escribe el valor en el campo; escribir
  a mano deselecciona el chip.
- **Reordenar:** flechas ↑↓ en el estado expandido (drag & drop queda como mejora futura).
- **Resumen en cabecera:** total calculado por deporte (metros totales en swim, km en run,
  nº ejercicios en gym).

Componentes nuevos en `components/training/`: `ExerciseAccordion.tsx`,
`SportSegment.tsx`, `VariantDropdown.tsx`, `Stepper.tsx`, `PresetChips.tsx`.
El desplegable de variante es un `Modal` anclado (funciona igual en web y nativo).

## 2. Pestaña «Agenda» (`app/(tabs)/agenda.tsx`)

Orden vertical: hero de carrera objetivo → calendario de eventos → próximos eventos →
resultados.

### Hero de carrera objetivo (`RaceHeroCard`)

- Gradiente rojo racing (`expo-linear-gradient`), nombre, fecha, distancia, objetivo
  (tiempo y ritmo derivado).
- Cuenta atrás: días y semanas (animación de contador al cambiar).
- **% de plan cumplido:** sesiones completadas / planificadas desde el inicio del plan.
- **Barra de fases** Base→Build→Peak→Taper→Race calculada **hacia atrás desde la fecha de
  la carrera** (lógica pura en `lib/agenda/phases.ts`): Race = semana de carrera,
  Taper = 2 semanas antes, Peak = 4 antes, Build = 4 antes, Base = el resto desde
  `start_date`. La fase actual se resalta.
- Si no hay carrera objetivo: estado vacío con CTA «Añade tu primera carrera».

### Calendario de eventos (`EventsCalendar`)

- Vista mensual propia (grid 7×n, sin dependencia externa), navegación ‹ › con animación
  de deslizamiento.
- **Solo muestra eventos manuales:** carreras (🏁, borde rojo) y eventos personales
  (icono elegido, borde ámbar). Los entrenamientos no aparecen.
- Eventos multi-día (`end_date`) pintan el rango.
- Tocar un día con evento → detalle; día vacío → alta rápida con esa fecha.

### Alta/edición de evento (modal)

- Selector de tipo: **Evento** o **Carrera**.
- Comunes: título, fecha (y fecha fin opcional), icono (picker de emojis frecuentes:
  ✈️ 🩺 🎂 📌 …), notas.
- Carrera añade: distancia (km, chips 5/10/21,1/42,2 + manual), tiempo objetivo,
  «Carrera objetivo» (toggle). Solo una puede ser objetivo: activarla desmarca la anterior
  y sincroniza `training_plans.goal_race_date` (escritura cliente con JWT, como todo).

### Resultados post-carrera

- Cuando `date < hoy` y sin resultado, la carrera muestra CTA «Registrar resultado»:
  tiempo final, posición (opcional), sensaciones (texto).
- Ritmo se deriva; **PB** si mejora el mejor tiempo previo en la misma distancia
  (`lib/agenda/pb.ts`), badge ✨ + confeti.
- Al guardar, se pide análisis al coach (ver §4) y se guarda en el evento.

## 3. Base de datos

Tabla nueva en `supabase/schema.sql` (+ archivo de migración `supabase/migrations/`):

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  end_date date,
  kind text not null check (kind in ('race','event')),
  icon text,
  notes text,
  race jsonb,
  created_at timestamptz not null default now()
);
alter table events enable row level security;
-- policies owner-only (select/insert/update/delete: user_id = auth.uid())
```

`race` jsonb: `{ distance_km, target_time, result_time, position, feelings, ai_analysis,
is_goal }`. Tiempos como `"1:29:59"` (string); validación y parsing en
`lib/agenda/time.ts`. Tipos TS en `types/index.ts` (`CalendarEvent`, `RaceDetails`).
Acceso vía hook `hooks/useEvents.ts` (CRUD + suscripción simple por refetch).

## 4. Coach IA

- `lib/coach/context.ts`: añade al contexto las próximas carreras (nombre, fecha, días
  restantes, objetivo) y el último resultado. El coach puede razonar sobre el taper y
  la cuenta atrás en chat y en la home.
- Tras registrar un resultado: llamada a `/api/coach` **sin tools** con resumen
  (objetivo vs resultado, ritmo, sensaciones, contexto del plan) → texto guardado en
  `race.ai_analysis` y visible en el detalle de la carrera.
- Sin cambios de servidor: los endpoints existentes bastan. Regla de oro intacta
  (el servidor nunca tiene `service_role`; escrituras desde el cliente con JWT).

## 5. Paquete premium (transversal)

Dependencias nuevas: `expo-haptics`, `expo-linear-gradient`. Reanimated 4.3.1 ya está.

1. **Acordeones/desplegables animados** — spring en altura + rotación de chevron (editor,
   semana, agenda).
2. **Hápticos** — `lib/haptics.ts` (wrapper no-op en web): light en chips/steppers,
   success al guardar/completar.
3. **Gradientes por deporte** — cabeceras de hoy/semana y hero de carrera; tokens de
   gradiente junto a `SessionColors` en `constants/colors.ts`.
4. **Anillo de progreso semanal** — `components/ui/ProgressRing.tsx` (react-native-svg +
   Reanimated) en «Hoy»: sesiones completadas/planificadas de la semana, se anima al abrir.
5. **Celebraciones** — `components/ui/Confetti.tsx` (partículas Reanimated, sin dependencia
   nueva): al completar sesión y al registrar PB. Breve (~1,5 s), no bloquea.
6. **Entradas escalonadas** — `Animated.View` con `FadeInDown.delay(i*40)` en listas
   (semana, historial, agenda).
7. **Feedback al pulsar** — `components/ui/Pressable.tsx` (scale 0.97 con spring) usado por
   Card/Button/chips.
8. **Cuenta atrás viva** — dígitos con transición vertical al cambiar de valor.

Accesibilidad: si `AccessibilityInfo.isReduceMotionEnabled()`, se desactivan confeti y
entradas escalonadas (los acordeones pasan a transición corta).

## 6. Tests (vitest, como `tests/coach/`)

- `tests/agenda/phases.test.ts` — fases hacia atrás desde la carrera; bordes (plan más
  corto que las fases, carrera pasada).
- `tests/agenda/pb.test.ts` — detección de PB por distancia; primera carrera; empates.
- `tests/agenda/time.test.ts` — parseo/formato de tiempos y ritmo derivado.
- `tests/training/summary.test.ts` — resúmenes del acordeón y totales por deporte.
  (La lógica de resumen vive en `lib/training/summary.ts` para ser testeable.)

## Manejo de errores

- Guardados de eventos/resultados: `Alert` con mensaje en español y estado `saving`
  (patrón actual del editor).
- Calendario y hero degradan a estados vacíos claros si no hay datos o falla la carga.

## Fuera de alcance

Import Garmin (.FIT/.TCX), grabación de voz nativa, resumen semanal automático,
cifrado BYOK y rate limiting (siguen en `docs/BACKLOG.md`). Drag & drop de ejercicios
(v2; en v1 flechas ↑↓).

## Archivos afectados (resumen)

- **Nuevos:** `app/(tabs)/agenda.tsx`; `components/agenda/{RaceHeroCard,EventsCalendar,EventModal,EventRow,ResultModal}.tsx`;
  `components/training/{ExerciseAccordion,SportSegment,VariantDropdown,Stepper,PresetChips}.tsx`;
  `components/ui/{ProgressRing,Confetti,Pressable}.tsx`;
  `lib/agenda/{phases,pb,time}.ts`; `lib/training/summary.ts`; `lib/haptics.ts`;
  `hooks/useEvents.ts`; migración SQL; tests.
- **Modificados:** `app/plan/[day].tsx` (reescritura del cuerpo), `app/(tabs)/_layout.tsx`
  (tab Agenda), `app/(tabs)/hoy.tsx` (anillo + cuenta atrás breve), `lib/coach/context.ts`,
  `types/index.ts`, `constants/colors.ts`, `supabase/schema.sql`, `CLAUDE.md` (estructura).

# Onboarding con encuesta + plan generado de 4 semanas — Diseño

**Fecha:** 2026-07-08
**Estado:** aprobado en brainstorming

## Objetivo

Cuando un usuario nuevo se registra, una encuesta captura qué deporte(s) practica,
su objetivo, disponibilidad y nivel, y se genera al instante un plan de 4 semanas
progresivas acorde a sus respuestas. Generación 100 % local con plantillas
(gratis, determinista, sin depender de key de Groq que un usuario recién
registrado aún no tiene).

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Generación del plan | Plantillas estáticas + generador composicional (no IA) |
| Deportes | Multi-selección: running, natación, gimnasio/fuerza, Hyrox |
| Objetivos | Preparar carrera/competición · forma general · perder peso · ganar fuerza/músculo |
| Encuesta también pregunta | Días disponibles/semana (3–7), nivel (principiante/intermedio/avanzado), fecha de evento si el objetivo es carrera |
| Estructura del plan | 4 semanas progresivas (carga creciente + descarga en la 4ª) |
| Quién la ve | Automática para usuarios sin plan guardado; relanzable desde la pantalla Plan |

## Flujo y pantallas

### Wizard `app/onboarding.tsx`

Pantalla completa fuera de tabs, sin header, con barra de progreso. Sistema de
diseño actual (dark Apple, cards `#1C1C1E`, azul `#0A84FF`). Cinco pasos:

1. **Deportes** — cards multi-selección: running, natación, gimnasio/fuerza, Hyrox.
   Mínimo uno para continuar.
2. **Objetivo** — selección única: preparar carrera/competición, mejorar forma
   general, perder peso, ganar fuerza/músculo.
3. **Evento** — solo si el objetivo es carrera/competición: distancia
   (5K / 10K / media maratón / maratón / Hyrox) y fecha opcional (puede omitirse).
4. **Disponibilidad y nivel** — días/semana (3–7) y nivel (principiante /
   intermedio / avanzado) en el mismo paso.
5. **Resumen** — respuestas + botón «Generar mi plan». Enlace discreto «Usar plan
   por defecto» que guarda el plan estándar (WEEKLY_STRUCTURE convertido a v2)
   sin generar.

### Cuándo aparece

El guard del root `app/_layout.tsx` (junto al auth guard existente) redirige a
`/onboarding` cuando hay sesión y `PlanContext` terminó de cargar sin plan
guardado en `training_plans`. Al guardar, redirige a `(tabs)/hoy`.

### Relanzado

Botón «Rehacer encuesta» en `app/plan/index.tsx` que navega a `/onboarding`.
En el paso Resumen se avisa de que el plan nuevo sustituye al actual. Las
sesiones registradas en `training_sessions` no se tocan.

### Efectos al finalizar

- Guarda `plan_data` v2 en `training_plans` (upsert de la fila del usuario) con
  `start_date` = lunes de la semana actual, `phase: 'base'`.
- Si el objetivo es carrera con fecha: crea el evento en `events` como carrera
  objetivo (reutilizando el código de agenda/useEvents) y sincroniza
  `goal_race_date` en `training_plans`.

## Modelo de datos

### `plan_data` v2 (sin migración SQL; es jsonb)

```ts
// v2
{ version: 2, profile: OnboardingAnswers | null, weeks: WeekPlan[] } // 4 semanas
// legacy (formato actual)
DayPlan[] // 7 días
```

- `PlanContext` normaliza al cargar: array legacy → 4 semanas idénticas con
  `profile: null`, en memoria (no se reescribe en DB hasta el siguiente
  guardado). Mismo patrón que `lib/training/normalize.ts`.
- Nuevos tipos en `types/index.ts`:
  - `SportChoice = 'run' | 'swim' | 'gym' | 'hyrox'` (el `SportGroup` existente
    no incluye hyrox y significa otra cosa: agrupa tipos de sesión para la UI).
  - `OnboardingAnswers = { sports: SportChoice[], goal, raceDistance?,
    raceDate?, daysPerWeek, level }` con uniones literales para `goal`
    (`'race' | 'general_fitness' | 'lose_weight' | 'gain_strength'`),
    `raceDistance` (`'5k' | '10k' | 'half' | 'marathon' | 'hyrox'`) y `level`
    (`'beginner' | 'intermediate' | 'advanced'`).

### Semana actual

`currentWeekIndex = clamp(floor((hoy − start_date) / 7 días), 0, 3)`. Pasada la
semana 4 se queda en la última y la pestaña Semana muestra el aviso «Plan
completado — rehaz la encuesta para generar el siguiente bloque».

### Cambios en pantallas existentes

- `PlanContext` expone `weeks`, `currentWeekIndex` y `days` (días de la semana
  seleccionada/actual). Hoy y el editor siguen consumiendo `days` casi sin
  cambios.
- **Semana**: selector Sem 1·2·3·4 con la actual marcada y el `focus` de cada
  semana como subtítulo.
- **Editor** (`plan/[day].tsx`): edita el día de la semana seleccionada; guardar
  reescribe solo esa semana dentro de `weeks`.

## Generador `lib/planGenerator/`

Funciones puras, deterministas, sin red. Cuatro módulos:

### `library.ts` — biblioteca de sesiones

Por deporte, 2–3 sesiones tipo como funciones `(level) => DayPlan` que ajustan
series/duración/cargas por nivel. Reutilizan `SessionType` y `ExerciseTemplate`
existentes.

- **Running:** rodaje suave (`running_easy`), series/intervalos
  (`running_intervals`), tirada larga (`running_long`)
- **Natación:** técnica, series aeróbicas (`swimming`)
- **Gimnasio:** fuerza full-body, fuerza tren inferior + core (`gym_strength`)
- **Hyrox:** circuito funcional (`gym_hyrox`), simulación parcial
  (`hyrox_simulation`)

### `scheduler.ts` — reparto de días

`(sports, goal, daysPerWeek) => asignación por día de la semana`. El objetivo
define pesos: perder peso → más cardio; ganar fuerza → más gym; carrera →
prioriza el deporte de la carrera (Hyrox si la distancia es Hyrox). Reglas
fijas: días duros no consecutivos; tirada larga en sábado si hay running; días
sobrantes `rest`; con 6–7 días el último activo es `active_recovery`.

### `progression.ts` — las 4 semanas

Semana 1 base → 2 (+10 %) → 3 (+20 %) → 4 descarga (−40 %, `focus:
'Descarga'`). Escala `sets` (enteros) y `duration`/`distance` parseando los
strings («8 min», «100m») con redondeo sensato; lo no parseable se deja igual.
Cada `WeekPlan` lleva `focus` descriptivo y `phase: 'base'`.

### `generate.ts` — orquestador

`generatePlan(answers: OnboardingAnswers): WeekPlan[]`. Único punto de entrada
que importa el wizard.

## Manejo de errores

- **Guardado del plan falla:** el wizard permanece en Resumen con el error
  visible y reintento; las respuestas viven en estado local, no se pierden.
- **Creación del evento falla con plan ya guardado:** se continúa a Hoy con un
  aviso de que la carrera no se pudo crear en la agenda (puede crearse a mano).
  El plan nunca queda a medias por culpa del evento.
- **Sin sesión al guardar:** no aplica; el guard exige sesión para llegar al
  onboarding.

## Testing (vitest, ya configurado en `tests/`)

- `scheduler`: reparto correcto en combinaciones representativas (1 deporte ×
  3 días, 4 deportes × 7 días, etc.), sin días duros consecutivos, nº de
  sesiones = días pedidos.
- `progression`: escalado por semana, descarga en la 4ª, strings no parseables
  intactos, sets siempre enteros ≥ 1.
- Normalización legacy→v2: extraída a función pura (en `lib/planGenerator/` o
  `lib/training/normalize.ts`) y testeada con el shape actual de `plan_data`.

## Fuera de alcance

- Personalización posterior con IA (el coach ya puede ajustar el plan vía
  `adjust_plan`; un «personalizar con el coach» post-onboarding queda para el
  backlog).
- Regeneración automática al acabar las 4 semanas (el usuario rehace la
  encuesta manualmente).
- Cambios en el esquema SQL (todo cabe en el jsonb existente).

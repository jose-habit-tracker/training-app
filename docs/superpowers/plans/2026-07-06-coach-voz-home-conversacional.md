# Coach con voz + home conversacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La pestaña «Hoy» ☀️ se convierte en conversación con el Coach IA: audio → Whisper (Groq) → propuesta de acción estructurada (registrar/editar/borrar sesión, ajustar plan) → confirmación con un tap → escritura desde el cliente con RLS. Además: formulario de registro adaptativo por deporte con métricas (`subtype` + `metrics jsonb`) y pulido visual de Historial/Semana.

**Architecture:** Enfoque «agente en servidor, escrituras en cliente». Dos endpoints Vercel nuevos (`/api/transcribe`, `/api/coach`) con el mismo portero JWT+BYOK que `api/chat.ts`; tool-calling con validación server-side en `lib/coach/validate.ts` (módulo puro compartido cliente/servidor); ejecutores client-side en `lib/coach/actions.ts` que escriben vía supabase-js con la sesión del usuario. El servidor **nunca** tiene `service_role`.

**Tech Stack:** Expo SDK 56 + React Native Web, Expo Router, Supabase (RLS), Groq (`llama-3.3-70b-versatile` con tools + `whisper-large-v3`), MediaRecorder (web), Vercel Functions (@vercel/node), vitest para unidades puras.

**Spec:** `docs/superpowers/specs/2026-07-06-coach-voz-home-conversacional-design.md`

**Convenciones del repo:** TypeScript estricto, sin `any`. Tipos compartidos en `types/index.ts`. Estilos con `StyleSheet.create()` al final del archivo. UI en español, código en inglés. Temas vía `useTheme()` — nunca colores hardcodeados salvo blancos sobre acento. Los módulos de `lib/coach/` que importa el servidor NO pueden importar `react-native` (solo `lib/coach/api.ts` y `actions.ts`, que son client-only, pueden).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `package.json`, `vitest.config.ts` | Modificar/Crear | test runner para módulos puros |
| `types/index.ts` | Modificar | `SessionSubtype`, `SessionMetrics`, `TrainingSession.subtype/metrics` |
| `constants/trainingPlan.ts` | Modificar | `SUBTYPE_LABELS`, `SUBTYPES_BY_GROUP`, `sportGroupOf()` |
| `supabase/migrations/2026-07-06-coach-voz.sql` | Crear | ALTER TABLE idempotente |
| `supabase/schema.sql` | Modificar | columnas nuevas documentadas |
| `lib/coach/types.ts` | Crear | `ActionProposal`, `CoachReply`, args de cada acción |
| `lib/coach/validate.ts` | Crear | validación/saneado de args (puro, compartido) |
| `lib/coach/planMerge.ts` | Crear (mover) | `applyProposedDays` extraído de `app/chat/[id].tsx` |
| `lib/coach/context.ts` | Crear (mover) | system prompts (chat + coach con tools) |
| `lib/coach/greeting.ts` | Crear | saludo contextual determinista |
| `lib/coach/reply.ts` | Crear | `COACH_TOOLS` + `mapGroqResponse` (puro) |
| `lib/apiBase.ts` | Crear | `apiUrl()` — DRY del endpoint web/nativo |
| `lib/groq.ts` | Modificar | usa `apiUrl()` |
| `api/transcribe.ts` | Crear | JWT+BYOK → Groq Whisper |
| `api/coach.ts` | Crear | JWT+BYOK → chat completions con tools |
| `lib/coach/api.ts` | Crear | client: `transcribeAudio`, `askCoach` |
| `lib/coach/actions.ts` | Crear | ejecutores client-side (supabase + RLS) |
| `hooks/useTraining.ts` | Modificar | `getWeekForDate()` |
| `hooks/useRecorder.ts` | Crear | MediaRecorder (web); `unsupported` en nativo |
| `components/coach/MessageBubble.tsx` | Crear | burbuja de mensaje |
| `components/coach/ProposalCard.tsx` | Crear | tarjeta Confirmar/Editar |
| `components/coach/ActionChips.tsx` | Crear | chips 🎙/✍️/📋 |
| `components/coach/CoachInput.tsx` | Crear | input + micro con estados |
| `app/(tabs)/hoy.tsx` | Reescribir | home conversacional |
| `app/(tabs)/_layout.tsx` | Modificar | icono ☀️ (`sunny`) |
| `app/chat/[id].tsx` | Modificar | importa `planMerge`/`context` (DRY) |
| `components/training/RunningFields.tsx` | Crear | métricas running |
| `components/training/SwimFields.tsx` | Crear | métricas natación |
| `components/training/GymFields.tsx` | Crear | kg por ejercicio |
| `components/training/SubtypePicker.tsx` | Crear | selector de subtipo |
| `app/log/[day].tsx` | Modificar | formulario adaptativo + prefill + date |
| `app/(tabs)/historial.tsx` | Modificar | chips de métricas |
| `app/(tabs)/semana.tsx` | Modificar | dots de progreso semanal |
| `tests/coach/*.test.ts` | Crear | tests de los módulos puros |

---

### Task 1: Infraestructura de tests (vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Instalar vitest**

```bash
cd /Users/josemonrealbadia/Desktop/training-app && npm install -D vitest
```

- [ ] **Step 2: Añadir script `test` a package.json**

En `package.json`, dentro de `"scripts"`, añadir:

```json
"test": "vitest run"
```

- [ ] **Step 3: Crear vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

// Solo módulos puros (lib/coach sin react-native). La UI se verifica con tsc + E2E.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verificar que corre en vacío**

Run: `npx vitest run`
Expected: `No test files found` (exit code 1 es aceptable aquí; no hay tests aún).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-module tests"
```

---

### Task 2: Tipos, constantes de subtipo y migración SQL

**Files:**
- Modify: `types/index.ts`
- Modify: `constants/trainingPlan.ts` (al final del archivo)
- Create: `supabase/migrations/2026-07-06-coach-voz.sql`
- Modify: `supabase/schema.sql:43-57` (tabla training_sessions)

- [ ] **Step 1: Añadir tipos a `types/index.ts`** (después de `SessionType`, línea 11)

```ts
export type SessionSubtype =
  | 'easy'
  | 'long_run'
  | 'intervals'
  | 'threshold'
  | 'race'
  | 'swim_technique'
  | 'swim_sets'
  | 'strength'
  | 'hyrox_circuit'
  | 'recovery';

export type SportGroup = 'run' | 'swim' | 'gym' | 'other';

export interface SwimSet {
  reps: number;
  distancia_m: number;
  descripcion?: string;
}

export interface GymExerciseMetric {
  nombre: string;
  series: number;
  reps: string;
  kg?: number;
}

export interface SessionMetrics {
  distancia_km?: number;
  ritmo_min_km?: string; // "4:35"
  fc_media?: number;
  fc_max?: number;
  metros?: number;
  series?: SwimSet[];
  ejercicios?: GymExerciseMetric[];
}
```

Y en `TrainingSession` (tras `session_type: SessionType;`):

```ts
  subtype?: SessionSubtype;
  metrics?: SessionMetrics;
```

- [ ] **Step 2: Añadir constantes de subtipo al final de `constants/trainingPlan.ts`**

```ts
// ─── Subtipos de sesión (formulario adaptativo + coach) ─────────────────────
import type { SessionSubtype, SportGroup } from '../types';

export const SUBTYPE_LABELS: Record<SessionSubtype, string> = {
  easy: 'Rodaje suave',
  long_run: 'Tirada larga',
  intervals: 'Series / Intervalos',
  threshold: 'Umbral',
  race: 'Carrera / Competición',
  swim_technique: 'Técnica',
  swim_sets: 'Series natación',
  strength: 'Fuerza',
  hyrox_circuit: 'Circuito Hyrox',
  recovery: 'Recuperación',
};

export function sportGroupOf(type: SessionType): SportGroup {
  if (type.startsWith('running')) return 'run';
  if (type === 'swimming') return 'swim';
  if (type.startsWith('gym') || type === 'hyrox_simulation') return 'gym';
  return 'other';
}

export const SUBTYPES_BY_GROUP: Record<SportGroup, SessionSubtype[]> = {
  run: ['easy', 'long_run', 'intervals', 'threshold', 'race'],
  swim: ['swim_technique', 'swim_sets'],
  gym: ['strength', 'hyrox_circuit'],
  other: ['recovery'],
};
```

Nota: `constants/trainingPlan.ts` ya importa `SessionType` de `../types`; funde el import nuevo con el existente (un solo `import type { ... } from '../types'`).

- [ ] **Step 3: Crear `supabase/migrations/2026-07-06-coach-voz.sql`**

```sql
-- Coach con voz: subtipo + métricas por deporte en training_sessions.
-- Idempotente: ejecutable en el SQL editor de Supabase sin peligro.

alter table public.training_sessions
  add column if not exists subtype text
    check (subtype in ('easy','long_run','intervals','threshold','race',
                       'swim_technique','swim_sets','strength','hyrox_circuit','recovery'));

alter table public.training_sessions
  add column if not exists metrics jsonb;
```

- [ ] **Step 4: Reflejar las columnas en `supabase/schema.sql`**

En la definición de `training_sessions` (tras `session_type text not null,`):

```sql
  subtype text check (subtype in ('easy','long_run','intervals','threshold','race',
                                  'swim_technique','swim_sets','strength','hyrox_circuit','recovery')),
  metrics jsonb,
```

- [ ] **Step 5: Ejecutar la migración en Supabase** (paso manual del usuario o vía REST no es posible — SQL editor)

Pedir al usuario ejecutar el contenido de `supabase/migrations/2026-07-06-coach-voz.sql` en el SQL editor de Supabase (https://supabase.com/dashboard → proyecto → SQL editor). **Bloqueante para el E2E final, no para seguir codificando.**

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 7: Verificar la columna vía REST** (tras el paso manual)

```bash
cd /Users/josemonrealbadia/Desktop/training-app
KEY=$(grep '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env.local | cut -d= -f2-)
curl -s "https://fsrnplttkvhudhtcsrmv.supabase.co/rest/v1/training_sessions?select=subtype,metrics&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expected: `[]` (HTTP 200). Si devuelve error de columna inexistente, la migración no se ejecutó.

- [ ] **Step 8: Commit**

```bash
git add types/index.ts constants/trainingPlan.ts supabase/
git commit -m "feat: session subtype + per-sport metrics types and schema"
```

---

### Task 3: `lib/coach/types.ts` + `lib/coach/validate.ts` (TDD)

**Files:**
- Create: `lib/coach/types.ts`
- Create: `lib/coach/validate.ts`
- Test: `tests/coach/validate.test.ts`

`validate.ts` es la frontera de confianza: los args vienen del LLM y NUNCA se usan sin pasar por aquí. Es puro (sin react-native) porque lo importa también el servidor.

- [ ] **Step 1: Crear `lib/coach/types.ts`**

```ts
import type { SessionType, SessionSubtype, SessionMetrics, DayPlan } from '../../types';

export interface LogSessionArgs {
  session_date: string; // YYYY-MM-DD
  session_type: SessionType;
  subtype?: SessionSubtype;
  duration_min?: number;
  rpe?: number;
  fatigue?: number;
  notes?: string;
  metrics?: SessionMetrics;
}

// session_date identifica la sesión a editar; el resto son los campos a cambiar.
export type EditSessionArgs = { session_date: string } & Partial<Omit<LogSessionArgs, 'session_date'>>;

export interface DeleteSessionArgs {
  session_date: string;
}

// Días propuestos tal cual vienen del LLM; el merge/saneado fino lo hace planMerge.
export interface AdjustPlanArgs {
  days: Partial<DayPlan>[];
}

export type ActionProposal =
  | { action: 'log_session'; args: LogSessionArgs }
  | { action: 'edit_session'; args: EditSessionArgs }
  | { action: 'delete_session'; args: DeleteSessionArgs }
  | { action: 'adjust_plan'; args: AdjustPlanArgs };

export type CoachReply =
  | { kind: 'text'; content: string }
  | { kind: 'proposal'; content: string; proposal: ActionProposal };
```

- [ ] **Step 2: Escribir el test que falla — `tests/coach/validate.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateProposal } from '../../lib/coach/validate';

describe('validateProposal', () => {
  it('acepta log_session válido y descarta campos extra', () => {
    const p = validateProposal('log_session', {
      session_date: '2026-07-06',
      session_type: 'running_threshold',
      subtype: 'threshold',
      duration_min: 55,
      rpe: 7,
      fatigue: 6,
      notes: 'piernas cargadas',
      metrics: { distancia_km: 12.5, ritmo_min_km: '4:24', hack: 'x' },
      evil_extra: true,
    });
    expect(p).not.toBeNull();
    if (p?.action !== 'log_session') throw new Error('acción incorrecta');
    expect(p.args.session_type).toBe('running_threshold');
    expect(p.args.metrics).toEqual({ distancia_km: 12.5, ritmo_min_km: '4:24' });
    expect('evil_extra' in p.args).toBe(false);
  });

  it('rechaza log_session sin fecha válida o sin tipo', () => {
    expect(validateProposal('log_session', { session_type: 'swimming' })).toBeNull();
    expect(validateProposal('log_session', { session_date: '6/7/26', session_type: 'swimming' })).toBeNull();
    expect(validateProposal('log_session', { session_date: '2026-07-06', session_type: 'yoga' })).toBeNull();
  });

  it('acota rpe/fatigue a 1..10 y duración a 1..600 (fuera de rango → descartado)', () => {
    const p = validateProposal('log_session', {
      session_date: '2026-07-06',
      session_type: 'swimming',
      rpe: 17,
      fatigue: 0,
      duration_min: 5000,
    });
    if (p?.action !== 'log_session') throw new Error('acción incorrecta');
    expect(p.args.rpe).toBeUndefined();
    expect(p.args.fatigue).toBeUndefined();
    expect(p.args.duration_min).toBeUndefined();
  });

  it('edit_session exige fecha y al menos un campo a cambiar', () => {
    expect(validateProposal('edit_session', { session_date: '2026-07-05' })).toBeNull();
    const p = validateProposal('edit_session', { session_date: '2026-07-05', rpe: 8 });
    expect(p?.action).toBe('edit_session');
  });

  it('delete_session solo necesita fecha', () => {
    expect(validateProposal('delete_session', { session_date: '2026-07-05' })?.action).toBe('delete_session');
    expect(validateProposal('delete_session', {})).toBeNull();
  });

  it('adjust_plan exige array days no vacío con day válido', () => {
    expect(validateProposal('adjust_plan', { days: [] })).toBeNull();
    expect(validateProposal('adjust_plan', { days: [{ day: 'funday' }] })).toBeNull();
    const p = validateProposal('adjust_plan', { days: [{ day: 'saturday', duration: 90 }] });
    expect(p?.action).toBe('adjust_plan');
  });

  it('métricas de natación y gym se sanean elemento a elemento', () => {
    const p = validateProposal('log_session', {
      session_date: '2026-07-06',
      session_type: 'swimming',
      metrics: {
        metros: 2000,
        series: [{ reps: 8, distancia_m: 50 }, { reps: 'x', distancia_m: 100 }],
        ejercicios: [{ nombre: 'Sentadilla', series: 4, reps: '8', kg: 80 }, { series: 3 }],
      },
    });
    if (p?.action !== 'log_session') throw new Error('acción incorrecta');
    expect(p.args.metrics?.series).toEqual([{ reps: 8, distancia_m: 50 }]);
    expect(p.args.metrics?.ejercicios).toEqual([{ nombre: 'Sentadilla', series: 4, reps: '8', kg: 80 }]);
  });

  it('acción desconocida → null', () => {
    expect(validateProposal('drop_tables', {})).toBeNull();
  });
});
```

- [ ] **Step 3: Verificar que falla**

Run: `npx vitest run tests/coach/validate.test.ts`
Expected: FAIL — `Cannot find module '../../lib/coach/validate'`

- [ ] **Step 4: Implementar `lib/coach/validate.ts`**

```ts
import type { SessionType, SessionSubtype, SessionMetrics, SwimSet, GymExerciseMetric, DayPlan } from '../../types';
import type { ActionProposal, LogSessionArgs, EditSessionArgs } from './types';

// Los args vienen del LLM: cada campo se fuerza a su tipo y rango, y lo que no
// encaje se descarta en silencio. Nunca se propaga nada no listado aquí.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SESSION_TYPES: readonly SessionType[] = [
  'running_easy', 'running_threshold', 'running_long', 'running_intervals',
  'swimming', 'gym_strength', 'gym_hyrox', 'hyrox_simulation', 'rest', 'active_recovery',
];
const SUBTYPES: readonly SessionSubtype[] = [
  'easy', 'long_run', 'intervals', 'threshold', 'race',
  'swim_technique', 'swim_sets', 'strength', 'hyrox_circuit', 'recovery',
];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function optIntInRange(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
}
function optPosNumber(v: unknown, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : undefined;
}
function optStr(v: unknown, maxLen = 500): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, maxLen) : undefined;
}

function sanitizeSwimSet(v: unknown): SwimSet | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const reps = optIntInRange(o.reps, 1, 200);
  const distancia_m = optIntInRange(o.distancia_m, 1, 10000);
  if (reps === undefined || distancia_m === undefined) return null;
  const set: SwimSet = { reps, distancia_m };
  const descripcion = optStr(o.descripcion, 120);
  if (descripcion) set.descripcion = descripcion;
  return set;
}

function sanitizeGymExercise(v: unknown): GymExerciseMetric | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const nombre = optStr(o.nombre, 80);
  const series = optIntInRange(o.series, 1, 50);
  const reps = optStr(o.reps, 40);
  if (!nombre || series === undefined || !reps) return null;
  const ex: GymExerciseMetric = { nombre, series, reps };
  const kg = optPosNumber(o.kg, 1000);
  if (kg !== undefined) ex.kg = kg;
  return ex;
}

function sanitizeMetrics(v: unknown): SessionMetrics | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const m: SessionMetrics = {};
  const distancia_km = optPosNumber(o.distancia_km, 200);
  if (distancia_km !== undefined) m.distancia_km = distancia_km;
  const ritmo = optStr(o.ritmo_min_km, 8);
  if (ritmo && /^\d{1,2}:\d{2}$/.test(ritmo)) m.ritmo_min_km = ritmo;
  const fc_media = optIntInRange(o.fc_media, 40, 230);
  if (fc_media !== undefined) m.fc_media = fc_media;
  const fc_max = optIntInRange(o.fc_max, 40, 240);
  if (fc_max !== undefined) m.fc_max = fc_max;
  const metros = optIntInRange(o.metros, 1, 30000);
  if (metros !== undefined) m.metros = metros;
  if (Array.isArray(o.series)) {
    const series = o.series.map(sanitizeSwimSet).filter((s): s is SwimSet => s !== null);
    if (series.length) m.series = series;
  }
  if (Array.isArray(o.ejercicios)) {
    const ejercicios = o.ejercicios.map(sanitizeGymExercise).filter((e): e is GymExerciseMetric => e !== null);
    if (ejercicios.length) m.ejercicios = ejercicios;
  }
  return Object.keys(m).length ? m : undefined;
}

function sessionDate(o: Record<string, unknown>): string | null {
  return typeof o.session_date === 'string' && DATE_RE.test(o.session_date) ? o.session_date : null;
}

// Campos editables comunes a log y edit (todo opcional).
function optionalSessionFields(o: Record<string, unknown>): Partial<Omit<LogSessionArgs, 'session_date' | 'session_type'>> & { session_type?: SessionType } {
  const out: ReturnType<typeof optionalSessionFields> = {};
  if (SESSION_TYPES.includes(o.session_type as SessionType)) out.session_type = o.session_type as SessionType;
  if (SUBTYPES.includes(o.subtype as SessionSubtype)) out.subtype = o.subtype as SessionSubtype;
  const duration_min = optIntInRange(o.duration_min, 1, 600);
  if (duration_min !== undefined) out.duration_min = duration_min;
  const rpe = optIntInRange(o.rpe, 1, 10);
  if (rpe !== undefined) out.rpe = rpe;
  const fatigue = optIntInRange(o.fatigue, 1, 10);
  if (fatigue !== undefined) out.fatigue = fatigue;
  const notes = optStr(o.notes);
  if (notes) out.notes = notes;
  const metrics = sanitizeMetrics(o.metrics);
  if (metrics) out.metrics = metrics;
  return out;
}

export function validateProposal(name: string, rawArgs: unknown): ActionProposal | null {
  if (!rawArgs || typeof rawArgs !== 'object') return null;
  const o = rawArgs as Record<string, unknown>;

  switch (name) {
    case 'log_session': {
      const date = sessionDate(o);
      const fields = optionalSessionFields(o);
      if (!date || !fields.session_type) return null;
      const args: LogSessionArgs = { session_date: date, ...fields, session_type: fields.session_type };
      return { action: 'log_session', args };
    }
    case 'edit_session': {
      const date = sessionDate(o);
      if (!date) return null;
      const fields = optionalSessionFields(o);
      if (Object.keys(fields).length === 0) return null;
      const args: EditSessionArgs = { session_date: date, ...fields };
      return { action: 'edit_session', args };
    }
    case 'delete_session': {
      const date = sessionDate(o);
      if (!date) return null;
      return { action: 'delete_session', args: { session_date: date } };
    }
    case 'adjust_plan': {
      if (!Array.isArray(o.days) || o.days.length === 0) return null;
      const days = o.days.filter(
        (d): d is Partial<DayPlan> =>
          !!d && typeof d === 'object' && DAY_KEYS.includes((d as { day?: unknown }).day as string),
      );
      if (days.length === 0) return null;
      return { action: 'adjust_plan', args: { days } };
    }
    default:
      return null;
  }
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `npx vitest run tests/coach/validate.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Typecheck y commit**

```bash
npx tsc --noEmit
git add lib/coach/types.ts lib/coach/validate.ts tests/coach/validate.test.ts
git commit -m "feat: coach action types + LLM-args validation boundary"
```

---

### Task 4: `lib/coach/planMerge.ts` — mover el merge del plan (DRY con el chat)

**Files:**
- Create: `lib/coach/planMerge.ts`
- Modify: `app/chat/[id].tsx:136-201` (borrar funciones movidas) y `:169` (import)
- Test: `tests/coach/planMerge.test.ts`

- [ ] **Step 1: Test — `tests/coach/planMerge.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { applyProposedDays } from '../../lib/coach/planMerge';
import type { DayPlan } from '../../types';

const base: DayPlan[] = [
  {
    day: 'monday', dayName: 'Lunes', sessionType: 'running_threshold',
    title: 'Running Umbral', duration: 60, description: 'Umbral 3x10',
    exercises: [{ id: 'm1', name: 'Umbral 10min', sets: 3, reps: '10 min' }],
  },
  {
    day: 'tuesday', dayName: 'Martes', sessionType: 'swimming',
    title: 'Natación Técnica', duration: 45, description: 'Técnica',
  },
];

describe('applyProposedDays', () => {
  it('funde solo los días propuestos y conserva el resto', () => {
    const out = applyProposedDays(base, [{ day: 'tuesday', title: 'Natación Series', duration: 50 } as DayPlan]);
    expect(out[0]).toEqual(base[0]);
    expect(out[1].title).toBe('Natación Series');
    expect(out[1].duration).toBe(50);
    expect(out[1].sessionType).toBe('swimming'); // no propuesto → se conserva
  });

  it('descarta sessionType inválido y duración no positiva', () => {
    const out = applyProposedDays(base, [
      { day: 'monday', sessionType: 'yoga', duration: -5 } as unknown as DayPlan,
    ]);
    expect(out[0].sessionType).toBe('running_threshold');
    expect(out[0].duration).toBe(60);
  });

  it('sanea ejercicios: sin nombre → fuera', () => {
    const out = applyProposedDays(base, [
      { day: 'monday', exercises: [{ name: 'Cuestas' }, { sets: 3 }] } as unknown as DayPlan,
    ]);
    expect(out[0].exercises?.length).toBe(1);
    expect(out[0].exercises?.[0].name).toBe('Cuestas');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/coach/planMerge.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Crear `lib/coach/planMerge.ts`** — es EXACTAMENTE el código de `app/chat/[id].tsx` líneas 136-201 (funciones `optStr`, `str`, `optNum`, `sanitizeExercise`, `applyProposed`), movido y con dos cambios: `applyProposed` se exporta como `applyProposedDays`, y `SESSION_TYPE_KEYS` se define aquí:

```ts
import { DayPlan, ExerciseTemplate, SessionType } from '../../types';
import { SESSION_LABELS } from '../../constants/trainingPlan';

const SESSION_TYPE_KEYS = Object.keys(SESSION_LABELS);

// ─── Saneado de la salida del LLM ───────────────────────────────────────────
// Los días propuestos los escribe la IA; nunca confiamos en su forma. Cada campo
// se fuerza a su tipo esperado y lo que no encaje se descarta.
function optStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
function optNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function sanitizeExercise(ex: unknown, id: string): ExerciseTemplate | null {
  if (!ex || typeof ex !== 'object') return null;
  const e = ex as Record<string, unknown>;
  const name = typeof e.name === 'string' ? e.name.trim() : '';
  if (!name) return null;
  return {
    id,
    name,
    sets: optNum(e.sets),
    reps: optStr(e.reps),
    load: optStr(e.load),
    distance: optStr(e.distance),
    duration: optStr(e.duration),
    rest: optStr(e.rest),
    notes: optStr(e.notes),
  };
}

// Fusiona los días propuestos sobre el plan actual, validando cada campo.
export function applyProposedDays(current: DayPlan[], proposed: DayPlan[]): DayPlan[] {
  return current.map((d) => {
    const raw = proposed.find(
      (x) => x && typeof x === 'object' && (x as { day?: unknown }).day === d.day,
    ) as Record<string, unknown> | undefined;
    if (!raw) return d;

    const sessionType: SessionType = SESSION_TYPE_KEYS.includes(raw.sessionType as string)
      ? (raw.sessionType as SessionType)
      : d.sessionType;

    const exercises = Array.isArray(raw.exercises)
      ? raw.exercises
          .map((ex, i) => sanitizeExercise(ex, `${d.day}-${Date.now()}-${i}`))
          .filter((ex): ex is ExerciseTemplate => ex !== null)
      : d.exercises;

    const durNum = Number(raw.duration);

    return {
      day: d.day,
      dayName: d.dayName,
      sessionType,
      title: str(raw.title, d.title),
      duration: Number.isFinite(durNum) && durNum > 0 ? durNum : d.duration,
      description: str(raw.description, d.description),
      exercises,
      warmup: optStr(raw.warmup) ?? d.warmup,
      cooldown: optStr(raw.cooldown) ?? d.cooldown,
      notes: optStr(raw.notes) ?? d.notes,
    };
  });
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/coach/planMerge.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Actualizar `app/chat/[id].tsx`**

1. Borrar las funciones `optStr`, `str`, `optNum`, `sanitizeExercise`, `applyProposed` y la constante `SESSION_TYPE_KEYS` (líneas 119-201 aprox).
2. Añadir import: `import { applyProposedDays } from '../../lib/coach/planMerge';`
3. En `handleApply`, cambiar `applyProposed(days, proposed)` por `applyProposedDays(days, proposed)`.

- [ ] **Step 6: Typecheck, tests y commit**

```bash
npx tsc --noEmit && npx vitest run
git add lib/coach/planMerge.ts tests/coach/planMerge.test.ts "app/chat/[id].tsx"
git commit -m "refactor: extract plan-merge sanitization to lib/coach/planMerge"
```

---

### Task 5: `lib/coach/context.ts` (system prompts) + `lib/coach/greeting.ts` (TDD)

**Files:**
- Create: `lib/coach/context.ts`
- Create: `lib/coach/greeting.ts`
- Modify: `app/chat/[id].tsx:44-116` (mover `buildSystemPrompt` y `DAY_MAP`)
- Test: `tests/coach/greeting.test.ts`

- [ ] **Step 1: Test del saludo — `tests/coach/greeting.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildGreeting } from '../../lib/coach/greeting';
import type { DayPlan, TrainingSession } from '../../types';

const plan: DayPlan = {
  day: 'monday', dayName: 'Lunes', sessionType: 'running_threshold',
  title: 'Running Umbral', duration: 60, description: 'Umbral',
};

describe('buildGreeting', () => {
  it('incluye sesión del día, duración y semana/fase', () => {
    const g = buildGreeting(plan, 4, 'Base', null);
    expect(g).toContain('Running Umbral');
    expect(g).toContain('60');
    expect(g).toContain('Semana 4');
    expect(g).toContain('Base');
  });

  it('avisa si la última fatiga fue alta (>=7)', () => {
    const last = { fatigue: 8, session_date: '2026-07-05' } as TrainingSession;
    expect(buildGreeting(plan, 4, 'Base', last)).toContain('fatiga 8');
  });

  it('sin plan del día → mensaje genérico sin crash', () => {
    const g = buildGreeting(null, 4, 'Base', null);
    expect(g.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/coach/greeting.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Crear `lib/coach/greeting.ts`**

```ts
import type { DayPlan, TrainingSession } from '../../types';

// Saludo contextual de la home. Determinista y local: sin llamada a la IA
// al abrir la pantalla (instantáneo y gratis).
export function buildGreeting(
  todayPlan: DayPlan | null,
  weekNumber: number,
  phaseLabel: string,
  lastSession: TrainingSession | null,
): string {
  const parts: string[] = [];

  if (todayPlan) {
    parts.push(`¡Buenas! Hoy toca ${todayPlan.title} (${todayPlan.duration} min).`);
  } else {
    parts.push('¡Buenas! Hoy no hay sesión programada.');
  }

  parts.push(`Semana ${weekNumber} · Fase ${phaseLabel}.`);

  if (lastSession?.fatigue != null && lastSession.fatigue >= 7) {
    parts.push(`En tu último registro marcaste fatiga ${lastSession.fatigue}/10 — escucha a las piernas y ajustamos si hace falta.`);
  }

  parts.push('Cuéntame cómo ha ido por voz o por texto, y yo me encargo de registrarlo.');
  return parts.join(' ');
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/coach/greeting.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Crear `lib/coach/context.ts`**

Mover desde `app/chat/[id].tsx`: la constante `DAY_MAP` (líneas 44-47) y la función `buildSystemPrompt` completa (líneas 50-116) renombrada a `buildChatSystemPrompt` y exportada, con sus imports (`DayPlan`, `TrainingSession`, `SESSION_LABELS`, `getCurrentWeek`). Añadir además el prompt del coach con tools:

```ts
import { DayPlan, TrainingSession } from '../../types';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { getCurrentWeek } from '../../hooks/useTraining';

export const DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

// [PEGAR AQUÍ buildChatSystemPrompt = buildSystemPrompt movido VERBATIM de app/chat/[id].tsx:50-116,
//  solo renombrado y con `export function`]

// Contexto compartido (fecha, plan del día, últimas sesiones, plan JSON) para el
// prompt del coach de la home, que actúa vía tools en lugar de bloques ```plan.
export function buildCoachSystemPrompt(days: DayPlan[], recentSessions: TrainingSession[]): string {
  const weekNumber = getCurrentWeek();
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const todayPlan = days.find((d) => d.day === DAY_MAP[now.getDay()]);
  const todayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todaySession = todayPlan
    ? `${todayPlan.title} (${SESSION_LABELS[todayPlan.sessionType] ?? todayPlan.sessionType}, ${todayPlan.duration} min, session_type=${todayPlan.sessionType})`
    : 'sin sesión definida';

  const sessionSummary = recentSessions.length > 0
    ? recentSessions.map((s) => {
        const parts = [
          `• ${s.day_name} (${s.session_date}): ${SESSION_LABELS[s.session_type] ?? s.session_type}`,
          s.rpe_perceived != null ? `RPE ${s.rpe_perceived}/10` : null,
          s.fatigue != null ? `Fatiga ${s.fatigue}/10` : null,
          s.notes ? `"${s.notes}"` : null,
        ].filter(Boolean);
        return parts.join(' — ');
      }).join('\n')
    : 'Sin sesiones recientes registradas.';

  const planJson = JSON.stringify(
    days.map((d) => ({
      day: d.day, dayName: d.dayName, sessionType: d.sessionType, title: d.title,
      duration: d.duration, description: d.description, warmup: d.warmup,
      cooldown: d.cooldown, notes: d.notes,
      exercises: (d.exercises ?? []).map(({ id, ...ex }) => ex),
    })),
  );

  return `Eres el coach personal de un atleta de 23 años que se prepara para una media maratón y Hyrox posteriormente.
El atleta entrena 7 días a la semana: running, natación y gimnasio (énfasis Hyrox).
Estás en la semana ${weekNumber} del ciclo.

HOY ES: ${todayStr} (${todayIso}). Sesión programada hoy: ${todaySession}.
No deduzcas el día por tu cuenta; usa siempre esta fecha como "hoy".

ÚLTIMAS SESIONES REGISTRADAS:
${sessionSummary}

PLAN COMPLETO ACTUAL (JSON, fuente de verdad):
${planJson}

CÓMO ACTUAR:
- Si el atleta te CUENTA un entrenamiento hecho (hoy o un día concreto), llama a log_session con la fecha correcta, el session_type adecuado y todas las métricas que mencione (distancia, ritmo mm:ss, FC, metros, series, pesos). No inventes valores que no haya dicho.
- Si pide CORREGIR un registro existente, llama a edit_session solo con los campos que cambian. Si pide borrarlo, delete_session.
- Si pide CAMBIAR el plan (mover/modificar sesiones futuras), llama a adjust_plan con los días completos modificados; "day" en inglés (monday...sunday) y sessionType uno de: ${Object.keys(SESSION_LABELS).join(', ')}.
- Si solo pregunta o charla, responde en texto normal SIN llamar herramientas.
- Llama como máximo a UNA herramienta por mensaje. El atleta siempre confirmará antes de aplicar.
- Responde siempre en español, conciso, tono motivador pero realista.`;
}
```

- [ ] **Step 6: Actualizar `app/chat/[id].tsx`**

1. Borrar `DAY_MAP` y `buildSystemPrompt` locales.
2. Import: `import { buildChatSystemPrompt } from '../../lib/coach/context';`
3. En el `useMemo`: `buildChatSystemPrompt(days, recentSessions)`.
4. Quitar imports que queden sin uso (`getCurrentWeek`, `DayPlan`... comprobar con tsc).

- [ ] **Step 7: Typecheck, tests y commit**

```bash
npx tsc --noEmit && npx vitest run
git add lib/coach/context.ts lib/coach/greeting.ts tests/coach/greeting.test.ts "app/chat/[id].tsx"
git commit -m "feat: coach system prompts module + deterministic home greeting"
```

---

### Task 6: `lib/coach/reply.ts` — tools de Groq + mapeo de respuesta (TDD)

**Files:**
- Create: `lib/coach/reply.ts`
- Test: `tests/coach/reply.test.ts`

- [ ] **Step 1: Test — `tests/coach/reply.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mapGroqResponse, COACH_TOOLS } from '../../lib/coach/reply';

function groqWith(message: unknown) {
  return { choices: [{ message }] };
}

describe('COACH_TOOLS', () => {
  it('define las cuatro acciones', () => {
    const names = COACH_TOOLS.map((t) => t.function.name);
    expect(names).toEqual(['log_session', 'edit_session', 'delete_session', 'adjust_plan']);
  });
});

describe('mapGroqResponse', () => {
  it('mensaje de texto normal → kind text', () => {
    const r = mapGroqResponse(groqWith({ content: 'Buen trabajo hoy.' }));
    expect(r).toEqual({ kind: 'text', content: 'Buen trabajo hoy.' });
  });

  it('tool_call válido → kind proposal con args saneados', () => {
    const r = mapGroqResponse(groqWith({
      content: 'Voy a registrarlo.',
      tool_calls: [{
        function: {
          name: 'log_session',
          arguments: JSON.stringify({ session_date: '2026-07-06', session_type: 'running_threshold', rpe: 7 }),
        },
      }],
    }));
    expect(r.kind).toBe('proposal');
    if (r.kind !== 'proposal') return;
    expect(r.proposal.action).toBe('log_session');
    expect(r.content).toBe('Voy a registrarlo.');
  });

  it('tool_call con args inválidos → degrada a texto, nunca revienta', () => {
    const r = mapGroqResponse(groqWith({
      content: null,
      tool_calls: [{ function: { name: 'log_session', arguments: '{"session_date":"ayer"}' } }],
    }));
    expect(r.kind).toBe('text');
    expect(r.content.length).toBeGreaterThan(0);
  });

  it('arguments con JSON roto → degrada a texto', () => {
    const r = mapGroqResponse(groqWith({
      tool_calls: [{ function: { name: 'log_session', arguments: '{oops' } }],
    }));
    expect(r.kind).toBe('text');
  });

  it('respuesta sin choices → texto de error controlado', () => {
    expect(mapGroqResponse({}).kind).toBe('text');
    expect(mapGroqResponse(null).kind).toBe('text');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/coach/reply.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar `lib/coach/reply.ts`**

```ts
import { validateProposal } from './validate';
import type { CoachReply } from './types';

// Definición de tools en formato OpenAI (Groq). Los schemas son orientativos
// para el modelo; la validación real y estricta es validateProposal.
const METRICS_SCHEMA = {
  type: 'object',
  description: 'Métricas del deporte. Solo las que el atleta mencione.',
  properties: {
    distancia_km: { type: 'number' },
    ritmo_min_km: { type: 'string', description: 'mm:ss por km, ej "4:35"' },
    fc_media: { type: 'integer' },
    fc_max: { type: 'integer' },
    metros: { type: 'integer', description: 'metros totales de natación' },
    series: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reps: { type: 'integer' }, distancia_m: { type: 'integer' }, descripcion: { type: 'string' },
        },
        required: ['reps', 'distancia_m'],
      },
    },
    ejercicios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' }, series: { type: 'integer' }, reps: { type: 'string' }, kg: { type: 'number' },
        },
        required: ['nombre', 'series', 'reps'],
      },
    },
  },
} as const;

const SESSION_FIELDS = {
  session_date: { type: 'string', description: 'YYYY-MM-DD' },
  session_type: {
    type: 'string',
    enum: ['running_easy', 'running_threshold', 'running_long', 'running_intervals',
           'swimming', 'gym_strength', 'gym_hyrox', 'hyrox_simulation', 'rest', 'active_recovery'],
  },
  subtype: {
    type: 'string',
    enum: ['easy', 'long_run', 'intervals', 'threshold', 'race',
           'swim_technique', 'swim_sets', 'strength', 'hyrox_circuit', 'recovery'],
  },
  duration_min: { type: 'integer' },
  rpe: { type: 'integer', minimum: 1, maximum: 10 },
  fatigue: { type: 'integer', minimum: 1, maximum: 10 },
  notes: { type: 'string' },
  metrics: METRICS_SCHEMA,
} as const;

export const COACH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'log_session',
      description: 'Registrar una sesión de entrenamiento completada que el atleta te cuenta.',
      parameters: {
        type: 'object',
        properties: SESSION_FIELDS,
        required: ['session_date', 'session_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_session',
      description: 'Corregir campos de una sesión ya registrada, identificada por su fecha.',
      parameters: {
        type: 'object',
        properties: SESSION_FIELDS,
        required: ['session_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_session',
      description: 'Eliminar la sesión registrada de una fecha.',
      parameters: {
        type: 'object',
        properties: { session_date: { type: 'string', description: 'YYYY-MM-DD' } },
        required: ['session_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_plan',
      description: 'Modificar días del plan semanal. Incluye cada día modificado COMPLETO.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
                dayName: { type: 'string' },
                sessionType: { type: 'string' },
                title: { type: 'string' },
                duration: { type: 'integer' },
                description: { type: 'string' },
                warmup: { type: 'string' },
                cooldown: { type: 'string' },
                notes: { type: 'string' },
                exercises: { type: 'array', items: { type: 'object' } },
              },
              required: ['day'],
            },
          },
        },
        required: ['days'],
      },
    },
  },
];

const FALLBACK_TEXT = 'No he podido preparar la acción con seguridad. ¿Me lo repites con la fecha y los datos concretos?';

// Convierte la respuesta cruda de Groq en CoachReply. Defensivo: cualquier
// forma inesperada degrada a texto, nunca lanza.
export function mapGroqResponse(data: unknown): CoachReply {
  const message = (data as { choices?: Array<{ message?: Record<string, unknown> }> } | null)
    ?.choices?.[0]?.message;
  if (!message || typeof message !== 'object') {
    return { kind: 'text', content: 'El coach no ha devuelto respuesta. Inténtalo de nuevo.' };
  }

  const content = typeof message.content === 'string' ? message.content : '';
  const toolCalls = message.tool_calls;

  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const fn = (toolCalls[0] as { function?: { name?: unknown; arguments?: unknown } }).function;
    const name = typeof fn?.name === 'string' ? fn.name : '';
    let rawArgs: unknown = null;
    if (typeof fn?.arguments === 'string') {
      try { rawArgs = JSON.parse(fn.arguments); } catch { rawArgs = null; }
    }
    const proposal = validateProposal(name, rawArgs);
    if (proposal) return { kind: 'proposal', content, proposal };
    return { kind: 'text', content: content || FALLBACK_TEXT };
  }

  return { kind: 'text', content: content || FALLBACK_TEXT };
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/coach/reply.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Typecheck y commit**

```bash
npx tsc --noEmit
git add lib/coach/reply.ts tests/coach/reply.test.ts
git commit -m "feat: Groq tool definitions + defensive response mapping"
```

---

### Task 7: `lib/apiBase.ts` + endpoint `/api/transcribe`

**Files:**
- Create: `lib/apiBase.ts`
- Modify: `lib/groq.ts:7-13` (usar `apiUrl`)
- Create: `api/transcribe.ts`

- [ ] **Step 1: Crear `lib/apiBase.ts`**

```ts
import { Platform } from 'react-native';

// En web el proxy es relativo; en nativo hace falta la URL absoluta del deploy.
export function apiUrl(path: string): string {
  if (Platform.OS === 'web') return path;
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!base) throw new Error('EXPO_PUBLIC_API_BASE_URL no configurada');
  return `${base.replace(/\/$/, '')}${path}`;
}
```

- [ ] **Step 2: Refactor `lib/groq.ts`**

Borrar la función `chatEndpoint` (líneas 7-13) y el import de `Platform`; añadir `import { apiUrl } from './apiBase';` y en el `fetch` usar `apiUrl('/api/chat')`.

- [ ] **Step 3: Crear `api/transcribe.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Límite de Vercel para el body: 4.5 MB. 3M chars de base64 ≈ 2.2 MB de audio
// opus ≈ >8 min — de sobra para notas de voz de 2 min.
const MAX_BASE64_CHARS = 3_000_000;
const WHISPER_MODEL = 'whisper-large-v3';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace('/rest/v1/', '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Portero: mismo patrón que /api/chat ────────────────────────────────────
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'No autorizado' });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: keyRow } = await userClient
    .from('user_ai_keys')
    .select('groq_key')
    .eq('user_id', user.id)
    .single();
  const groqKey = keyRow?.groq_key;
  if (!groqKey) return res.status(400).json({ error: 'NO_GROQ_KEY' });

  // ─── Saneado del body ────────────────────────────────────────────────────────
  const { audio, mime } = req.body ?? {};
  if (typeof audio !== 'string' || audio.length === 0) {
    return res.status(400).json({ error: 'audio (base64) requerido' });
  }
  if (audio.length > MAX_BASE64_CHARS) {
    return res.status(413).json({ error: 'AUDIO_TOO_LARGE' });
  }
  const mimeType = typeof mime === 'string' && /^audio\/[\w.+-]+(;.*)?$/.test(mime)
    ? mime
    : 'audio/webm';

  let buf: Buffer;
  try {
    buf = Buffer.from(audio, 'base64');
  } catch {
    return res.status(400).json({ error: 'base64 inválido' });
  }

  // ─── Groq Whisper (multipart) ────────────────────────────────────────────────
  const form = new FormData();
  const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
  form.append('file', new Blob([new Uint8Array(buf)], { type: mimeType }), `audio.${ext}`);
  form.append('model', WHISPER_MODEL);
  form.append('language', 'es');
  form.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  return res.status(200).json({ text: typeof data.text === 'string' ? data.text.trim() : '' });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add lib/apiBase.ts lib/groq.ts api/transcribe.ts
git commit -m "feat: /api/transcribe (Groq Whisper, BYOK) + shared apiUrl helper"
```

(La verificación con curl del 401/405 se hace en el Task 15 tras el deploy.)

---

### Task 8: Endpoint `/api/coach`

**Files:**
- Create: `api/coach.ts`

- [ ] **Step 1: Crear `api/coach.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { COACH_TOOLS, mapGroqResponse } from '../lib/coach/reply';

// Igual que /api/chat pero con tool-calling: la respuesta es un CoachReply
// ({kind:'text'|'proposal'}) ya validado. El servidor NUNCA escribe en la BD.
const ALLOWED_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS_CAP = 1024;

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace('/rest/v1/', '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'No autorizado' });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: keyRow } = await userClient
    .from('user_ai_keys')
    .select('groq_key')
    .eq('user_id', user.id)
    .single();
  const groqKey = keyRow?.groq_key;
  if (!groqKey) return res.status(400).json({ error: 'NO_GROQ_KEY' });

  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requerido' });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: ALLOWED_MODEL,
      messages,
      tools: COACH_TOOLS,
      tool_choice: 'auto',
      max_tokens: MAX_TOKENS_CAP,
      temperature: 0.4,
    }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  return res.status(200).json(mapGroqResponse(data));
}
```

- [ ] **Step 2: Typecheck y commit**

```bash
npx tsc --noEmit
git add api/coach.ts
git commit -m "feat: /api/coach tool-calling endpoint (JWT+BYOK, no service_role)"
```

---

### Task 9: Cliente HTTP (`lib/coach/api.ts`) + grabadora (`hooks/useRecorder.ts`)

**Files:**
- Create: `lib/coach/api.ts`
- Create: `hooks/useRecorder.ts`

- [ ] **Step 1: Crear `lib/coach/api.ts`**

```ts
import { supabase } from '../supabase';
import { apiUrl } from '../apiBase';
import type { ChatMessage } from '../../types';
import type { CoachReply } from './types';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión para usar el coach.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

function mapApiError(status: number, body: string): Error {
  if (body.includes('NO_GROQ_KEY')) {
    return new Error('Configura tu API key de Groq en Ajustes para usar el coach.');
  }
  if (body.includes('AUDIO_TOO_LARGE')) {
    return new Error('El audio es demasiado largo. Máximo ~2 minutos.');
  }
  return new Error(`Error del coach (${status}). Inténtalo de nuevo.`);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el audio'));
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? '');
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const headers = await authHeaders();
  const audio = await blobToBase64(blob);
  const response = await fetch(apiUrl('/api/transcribe'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ audio, mime: blob.type || 'audio/webm' }),
  });
  if (!response.ok) throw mapApiError(response.status, await response.text());
  const data = await response.json();
  return typeof data.text === 'string' ? data.text : '';
}

export async function askCoach(messages: ChatMessage[]): Promise<CoachReply> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl('/api/coach'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) throw mapApiError(response.status, await response.text());
  const data = (await response.json()) as CoachReply;
  if (data?.kind === 'proposal' && data.proposal) return data;
  return { kind: 'text', content: data?.kind === 'text' ? data.content : 'Respuesta inesperada del coach.' };
}
```

- [ ] **Step 2: Crear `hooks/useRecorder.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type RecorderStatus = 'idle' | 'recording' | 'unsupported';

const MAX_SECONDS = 120;

// Grabadora de notas de voz. Solo web (MediaRecorder); en nativo devuelve
// 'unsupported' — la interfaz queda lista para una implementación expo-audio.
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopResolveRef = useRef<((b: Blob | null) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  useEffect(() => {
    if (!supported) setStatus('unsupported');
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [supported]);

  const stop = useCallback((): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      rec.stop();
    });
  }, []);

  const start = useCallback(async () => {
    if (!supported || status === 'recording') return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus('idle');
      setSeconds(0);
      const blob = chunksRef.current.length
        ? new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        : null;
      stopResolveRef.current?.(blob);
      stopResolveRef.current = null;
    };
    recorderRef.current = rec;
    rec.start();
    setStatus('recording');
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) void stop();
        return s + 1;
      });
    }, 1000);
  }, [supported, status, stop]);

  const cancel = useCallback(async () => {
    stopResolveRef.current = null; // el blob resultante se descarta
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  return { status, seconds, supported, start, stop, cancel };
}
```

- [ ] **Step 3: Typecheck y commit**

```bash
npx tsc --noEmit
git add lib/coach/api.ts hooks/useRecorder.ts
git commit -m "feat: coach HTTP client + web MediaRecorder hook"
```

---

### Task 10: Ejecutores client-side (`lib/coach/actions.ts`)

**Files:**
- Modify: `hooks/useTraining.ts:15-20` (añadir `getWeekForDate`)
- Create: `lib/coach/actions.ts`

- [ ] **Step 1: Añadir `getWeekForDate` a `hooks/useTraining.ts`** (junto a `getCurrentWeek`)

```ts
export function getWeekForDate(dateStr: string): number {
  const diffMs = new Date(`${dateStr}T00:00:00`).getTime() - PLAN_START.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(PLAN_WEEKS, Math.max(1, week));
}
```

- [ ] **Step 2: Crear `lib/coach/actions.ts`**

```ts
import { supabase } from '../supabase';
import { getWeekForDate } from '../../hooks/useTraining';
import type { DayPlan } from '../../types';
import type { ActionProposal, LogSessionArgs, EditSessionArgs } from './types';
import { applyProposedDays } from './planMerge';

export interface ExecutorContext {
  days: DayPlan[];
  savePlan: (next: DayPlan[]) => Promise<string | null>;
}

function dayNameFor(dateStr: string): string {
  const name = new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Mapea args del coach → columnas de training_sessions. Solo claves presentes.
function sessionColumns(args: Partial<LogSessionArgs>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (args.session_type !== undefined) cols.session_type = args.session_type;
  if (args.subtype !== undefined) cols.subtype = args.subtype;
  if (args.duration_min !== undefined) cols.duration_min = args.duration_min;
  if (args.rpe !== undefined) cols.rpe_perceived = args.rpe;
  if (args.fatigue !== undefined) cols.fatigue = args.fatigue;
  if (args.notes !== undefined) cols.notes = args.notes;
  if (args.metrics !== undefined) cols.metrics = args.metrics;
  return cols;
}

async function logSession(args: LogSessionArgs): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'No hay sesión activa';

  // Una sesión por día: actualiza si existe (mismo criterio que el formulario).
  const { data: existing } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_date', args.session_date)
    .maybeSingle();

  const fields = {
    ...sessionColumns(args),
    day_name: dayNameFor(args.session_date),
    week_number: getWeekForDate(args.session_date),
    completed_at: new Date().toISOString(),
  };

  const query = existing
    ? supabase.from('training_sessions').update(fields).eq('id', existing.id)
    : supabase.from('training_sessions').insert({
        user_id: user.id,
        session_date: args.session_date,
        ...fields,
      });

  const { error } = await query;
  return error ? error.message : null;
}

async function editSession(args: EditSessionArgs): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'No hay sesión activa';

  const { data: existing } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_date', args.session_date)
    .maybeSingle();
  if (!existing) return `No hay ninguna sesión registrada el ${args.session_date}`;

  const { session_date, ...rest } = args;
  const { error } = await supabase
    .from('training_sessions')
    .update(sessionColumns(rest))
    .eq('id', existing.id);
  return error ? error.message : null;
}

async function deleteSession(date: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'No hay sesión activa';

  const { data, error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('session_date', date)
    .select('id');
  if (error) return error.message;
  if (!data || data.length === 0) return `No hay ninguna sesión registrada el ${date}`;
  return null;
}

// Ejecuta una propuesta CONFIRMADA por el usuario. Devuelve null si OK,
// o el mensaje de error. Escribe siempre con la sesión del usuario (RLS).
export async function executeProposal(
  proposal: ActionProposal,
  ctx: ExecutorContext,
): Promise<string | null> {
  switch (proposal.action) {
    case 'log_session':
      return logSession(proposal.args);
    case 'edit_session':
      return editSession(proposal.args);
    case 'delete_session':
      return deleteSession(proposal.args.session_date);
    case 'adjust_plan':
      return ctx.savePlan(applyProposedDays(ctx.days, proposal.args.days as DayPlan[]));
  }
}
```

- [ ] **Step 3: Typecheck, tests y commit**

```bash
npx tsc --noEmit && npx vitest run
git add hooks/useTraining.ts lib/coach/actions.ts
git commit -m "feat: client-side executors for confirmed coach actions (RLS writes)"
```

---

### Task 11: Componentes del coach (`components/coach/`)

**Files:**
- Create: `components/coach/MessageBubble.tsx`
- Create: `components/coach/ProposalCard.tsx`
- Create: `components/coach/ActionChips.tsx`
- Create: `components/coach/CoachInput.tsx`

- [ ] **Step 1: Crear `components/coach/MessageBubble.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  children?: React.ReactNode; // p. ej. una ProposalCard debajo del texto
}

export function MessageBubble({ role, content, children }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = role === 'user';
  return (
    <View style={[s.row, isUser ? s.rowUser : s.rowAi]}>
      {!isUser && (
        <View style={[s.avatar, { backgroundColor: colors.accent }]}>
          <Text style={s.avatarText}>C</Text>
        </View>
      )}
      <View
        style={[
          s.bubble,
          isUser
            ? { backgroundColor: colors.text }
            : { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
        ]}
      >
        {content.length > 0 && (
          <Text style={[s.text, { color: isUser ? colors.card : colors.text }]}>{content}</Text>
        )}
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: Spacing.base, alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.gapSm, marginBottom: 2,
  },
  avatarText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.black },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapMd,
    borderRadius: Radius.lg,
    gap: Spacing.gapSm,
  },
  text: { fontSize: FontSize.body, lineHeight: 22 },
});
```

- [ ] **Step 2: Crear `components/coach/ProposalCard.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS, SUBTYPE_LABELS } from '../../constants/trainingPlan';
import type { ActionProposal } from '../../lib/coach/types';

export type ProposalStatus = 'idle' | 'applying' | 'done' | 'error';

const ACTION_TITLES: Record<ActionProposal['action'], string> = {
  log_session: 'Propuesta de registro',
  edit_session: 'Propuesta de corrección',
  delete_session: 'Eliminar sesión',
  adjust_plan: 'Cambio en el plan',
};

// Resumen legible de la propuesta, línea a línea.
export function describeProposal(p: ActionProposal): string[] {
  if (p.action === 'adjust_plan') {
    return p.args.days.map((d) => `${d.dayName ?? d.day}: ${d.title ?? 'modificado'}${d.duration ? ` · ${d.duration} min` : ''}`);
  }
  if (p.action === 'delete_session') {
    return [`Sesión del ${p.args.session_date}`];
  }
  const a = p.args;
  const lines: string[] = [`Fecha: ${a.session_date}`];
  if (a.session_type) lines.push(`Tipo: ${SESSION_LABELS[a.session_type] ?? a.session_type}${a.subtype ? ` · ${SUBTYPE_LABELS[a.subtype]}` : ''}`);
  const nums: string[] = [];
  if (a.duration_min != null) nums.push(`${a.duration_min} min`);
  if (a.rpe != null) nums.push(`RPE ${a.rpe}`);
  if (a.fatigue != null) nums.push(`Fatiga ${a.fatigue}`);
  if (nums.length) lines.push(nums.join(' · '));
  const m = a.metrics;
  if (m) {
    const mm: string[] = [];
    if (m.distancia_km != null) mm.push(`${m.distancia_km} km`);
    if (m.ritmo_min_km) mm.push(`${m.ritmo_min_km}/km`);
    if (m.fc_media != null) mm.push(`FC ${m.fc_media}`);
    if (m.metros != null) mm.push(`${m.metros} m`);
    if (m.ejercicios?.length) mm.push(`${m.ejercicios.length} ejercicios con carga`);
    if (mm.length) lines.push(mm.join(' · '));
  }
  if (a.notes) lines.push(`Notas: «${a.notes}»`);
  return lines;
}

interface ProposalCardProps {
  proposal: ActionProposal;
  status: ProposalStatus;
  error?: string;
  onConfirm: () => void;
  onEdit?: () => void; // solo log/edit_session
}

export function ProposalCard({ proposal, status, error, onConfirm, onEdit }: ProposalCardProps) {
  const { colors } = useTheme();
  const isDestructive = proposal.action === 'delete_session';
  const accent = isDestructive ? colors.danger : colors.accent;

  return (
    <View style={[s.card, { borderColor: accent + '55', backgroundColor: accent + '10' }]}>
      <Text style={[s.title, { color: accent }]}>{ACTION_TITLES[proposal.action].toUpperCase()}</Text>
      {describeProposal(proposal).map((line, i) => (
        <Text key={i} style={[s.line, { color: colors.text }]}>{line}</Text>
      ))}

      {status === 'done' ? (
        <Text style={[s.doneText, { color: accent }]}>✓ Aplicado</Text>
      ) : (
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: accent }]}
            onPress={onConfirm}
            disabled={status === 'applying'}
            activeOpacity={0.8}
          >
            {status === 'applying'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.btnText}>{isDestructive ? 'Eliminar' : 'Confirmar'}</Text>}
          </TouchableOpacity>
          {onEdit && (
            <TouchableOpacity
              style={[s.btn, s.btnGhost, { borderColor: colors.border }]}
              onPress={onEdit}
              disabled={status === 'applying'}
              activeOpacity={0.8}
            >
              <Text style={[s.btnText, { color: colors.text2 }]}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {status === 'error' && !!error && (
        <Text style={[s.errorText, { color: colors.danger }]}>{error} — vuelve a tocar Confirmar para reintentar.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.base,
    gap: Spacing.gapXs,
    marginTop: Spacing.gapXs,
  },
  title: { fontSize: FontSize.xs, fontWeight: FontWeight.black, letterSpacing: 0.5 },
  line: { fontSize: FontSize.md, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.gapSm },
  btn: {
    paddingVertical: Spacing.gapSm,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    minWidth: 104,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  doneText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, marginTop: Spacing.gapSm },
  errorText: { fontSize: FontSize.sm, marginTop: Spacing.gapXs },
});
```

- [ ] **Step 3: Crear `components/coach/ActionChips.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface ActionChipsProps {
  onRecord: () => void;
  onManualLog: () => void;
  onViewPlan: () => void;
  micSupported: boolean;
}

export function ActionChips({ onRecord, onManualLog, onViewPlan, micSupported }: ActionChipsProps) {
  const { colors } = useTheme();
  const chips = [
    ...(micSupported ? [{ label: '🎙 Contar por voz', onPress: onRecord }] : []),
    { label: '✍️ Registrar', onPress: onManualLog },
    { label: '📋 Ver plan de hoy', onPress: onViewPlan },
  ];
  return (
    <View style={s.row}>
      {chips.map((c) => (
        <TouchableOpacity
          key={c.label}
          style={[s.chip, { backgroundColor: colors.accent + '16', borderColor: colors.accent + '44' }]}
          onPress={c.onPress}
          activeOpacity={0.75}
        >
          <Text style={[s.chipText, { color: colors.accent }]}>{c.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm, marginBottom: Spacing.base },
  chip: {
    paddingHorizontal: Spacing.gapMd + 2,
    paddingVertical: Spacing.gapXs + 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});
```

- [ ] **Step 4: Crear `components/coach/CoachInput.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';
import { Input } from '../ui/Input';
import { useRecorder } from '../../hooks/useRecorder';

interface CoachInputProps {
  onSendText: (text: string) => void;
  onSendAudio: (blob: Blob) => void;
  busy: boolean; // el coach está pensando o transcribiendo
  recorder: ReturnType<typeof useRecorder>; // inyectado para poder disparar el micro desde los chips
}

export function CoachInput({ onSendText, onSendAudio, busy, recorder }: CoachInputProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const { status, seconds, supported, start, stop, cancel } = recorder;

  function handleSend() {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onSendText(t);
  }

  async function handleMicPress() {
    if (status === 'recording') {
      const blob = await stop();
      if (blob) onSendAudio(blob);
    } else {
      await start();
    }
  }

  if (status === 'recording') {
    return (
      <View style={[s.row, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[s.recordingPill, { backgroundColor: colors.danger + '18', borderColor: colors.danger + '55' }]}>
          <View style={[s.recDot, { backgroundColor: colors.danger }]} />
          <Text style={[s.recText, { color: colors.text }]}>
            Grabando… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </Text>
          <TouchableOpacity onPress={cancel} hitSlop={8}>
            <Text style={[s.cancelText, { color: colors.text3 }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.micBtn, { backgroundColor: colors.danger }]}
          onPress={handleMicPress}
          activeOpacity={0.8}
        >
          <Ionicons name="stop" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.row, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      <Input
        value={text}
        onChangeText={setText}
        placeholder="Cuéntale al coach…"
        multiline
        containerStyle={s.inputContainer}
        returnKeyType="send"
        onSubmitEditing={handleSend}
        maxLength={600}
      />
      {text.trim().length > 0 ? (
        <TouchableOpacity
          style={[s.micBtn, { backgroundColor: busy ? colors.border : colors.text }]}
          onPress={handleSend}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator size="small" color={colors.text3} /> : <Ionicons name="arrow-up" size={18} color={colors.card} />}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[s.micBtn, { backgroundColor: supported && !busy ? colors.accent : colors.border }]}
          onPress={handleMicPress}
          disabled={!supported || busy}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="mic" size={18} color="#fff" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderTopWidth: 0.5,
    gap: Spacing.gapMd,
  },
  inputContainer: { flex: 1 },
  micBtn: {
    width: 40, height: 40, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  recordingPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.gapMd,
    borderRadius: Radius.pill, borderWidth: 1,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.gapMd,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  recText: { fontSize: FontSize.md, flex: 1 },
  cancelText: { fontSize: FontSize.md },
});
```

- [ ] **Step 5: Typecheck y commit**

```bash
npx tsc --noEmit
git add components/coach/
git commit -m "feat: coach UI components (bubble, proposal card, chips, voice input)"
```

---

### Task 12: Home conversacional — reescribir `app/(tabs)/hoy.tsx` + icono ☀️

**Files:**
- Rewrite: `app/(tabs)/hoy.tsx`
- Modify: `app/(tabs)/_layout.tsx:41-48` (icono `sunny`, headerTitle 'Hoy ☀️')

Notas de diseño:
- El saludo es local y NO se persiste (como `GREETING` en `app/chat/[id].tsx`).
- El hilo del día vive en `conversations` con título `Hoy · YYYY-MM-DD` (get-or-create) y mensajes en `ai_conversations` — reutiliza el modelo del chat.
- Las propuestas son efímeras (estado en memoria): si recargas, queda el texto del coach pero no la tarjeta. Decisión del spec, documentada aquí.
- «Editar» navega a `/log/[day]` con `prefill` (JSON de los args) — el formulario lo consume en Task 13.

- [ ] **Step 1: Reescribir `app/(tabs)/hoy.tsx` completo**

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { usePlan } from '../../lib/PlanContext';
import { useToday, getPhaseLabel } from '../../hooks/useTraining';
import { useRecorder } from '../../hooks/useRecorder';
import { buildGreeting } from '../../lib/coach/greeting';
import { buildCoachSystemPrompt, DAY_MAP } from '../../lib/coach/context';
import { askCoach, transcribeAudio } from '../../lib/coach/api';
import { executeProposal } from '../../lib/coach/actions';
import type { ActionProposal } from '../../lib/coach/types';
import { ChatMessage, TrainingSession } from '../../types';
import { MessageBubble } from '../../components/coach/MessageBubble';
import { ProposalCard, ProposalStatus } from '../../components/coach/ProposalCard';
import { ActionChips } from '../../components/coach/ActionChips';
import { CoachInput } from '../../components/coach/CoachInput';

interface ThreadItem {
  role: 'user' | 'assistant';
  content: string;
  proposal?: ActionProposal;
  proposalStatus?: ProposalStatus;
  proposalError?: string;
}

export default function HoyScreen() {
  const { colors } = useTheme();
  const { days, save } = usePlan();
  const { plan: todayPlan, weekNumber, dayKey, refresh } = useToday();
  const recorder = useRecorder();

  const [items, setItems] = useState<ThreadItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<TrainingSession[]>([]);
  const [busy, setBusy] = useState(false); // transcribiendo o esperando al coach
  const [busyLabel, setBusyLabel] = useState('');
  const [initializing, setInitializing] = useState(true);
  const listRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];
  const planToday = days.find((d) => d.day === DAY_MAP[new Date().getDay()]) ?? todayPlan;

  // ── Hilo del día: get-or-create en `conversations` + historial ───────────────
  useEffect(() => {
    let active = true;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setInitializing(false); return; }
      userIdRef.current = user.id;

      const { data: sessions } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false })
        .limit(3);
      if (active) setRecentSessions((sessions ?? []) as TrainingSession[]);

      const title = `Hoy · ${todayIso}`;
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', title)
        .limit(1)
        .maybeSingle();

      let convId = existing?.id as string | undefined;
      if (!convId) {
        const { data: created } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title })
          .select('id')
          .single();
        convId = created?.id;
      }
      if (!convId) { setInitializing(false); return; }
      conversationIdRef.current = convId;

      const { data: history } = await supabase
        .from('ai_conversations')
        .select('role, content')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      if (active) {
        setItems(((history ?? []) as ChatMessage[]).map((m) => ({ role: m.role, content: m.content })));
        setInitializing(false);
      }
    }
    init();
    return () => { active = false; };
  }, [todayIso]);

  useEffect(() => {
    if (items.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [items]);

  const persist = useCallback(async (msg: ChatMessage) => {
    if (!userIdRef.current || !conversationIdRef.current) return;
    await supabase.from('ai_conversations').insert({
      user_id: userIdRef.current,
      conversation_id: conversationIdRef.current,
      role: msg.role,
      content: msg.content,
    });
  }, []);

  // ── Enviar texto (escrito o transcrito) al coach ─────────────────────────────
  const sendToCoach = useCallback(async (text: string) => {
    const userMsg: ThreadItem = { role: 'user', content: text };
    setItems((prev) => [...prev, userMsg]);
    setBusy(true);
    setBusyLabel('Coach pensando…');
    await persist({ role: 'user', content: text });

    try {
      const historyMessages: ChatMessage[] = [...items, userMsg]
        .slice(-10)
        .map((i) => ({ role: i.role, content: i.content }));
      const systemPrompt = buildCoachSystemPrompt(days, recentSessions);
      const reply = await askCoach([{ role: 'assistant', content: systemPrompt } as ChatMessage & { role: 'system' }, ...historyMessages].map((m, idx) =>
        idx === 0 ? { ...m, role: 'system' as ChatMessage['role'] } : m,
      ) as ChatMessage[]);

      const assistantItem: ThreadItem = reply.kind === 'proposal'
        ? { role: 'assistant', content: reply.content, proposal: reply.proposal, proposalStatus: 'idle' }
        : { role: 'assistant', content: reply.content };
      setItems((prev) => [...prev, assistantItem]);
      if (assistantItem.content) await persist({ role: 'assistant', content: assistantItem.content });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Inténtalo de nuevo.';
      setItems((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }, [items, days, recentSessions, persist]);

  // ── Audio → transcripción → coach ────────────────────────────────────────────
  const handleAudio = useCallback(async (blob: Blob) => {
    setBusy(true);
    setBusyLabel('Transcribiendo…');
    try {
      const text = await transcribeAudio(blob);
      if (!text) {
        setItems((prev) => [...prev, { role: 'assistant', content: '⚠️ No he entendido el audio. ¿Lo repites?' }]);
        setBusy(false);
        return;
      }
      setBusy(false);
      await sendToCoach(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error transcribiendo.';
      setItems((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
      setBusy(false);
    }
  }, [sendToCoach]);

  // ── Confirmar propuesta ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (index: number) => {
    const item = items[index];
    if (!item?.proposal) return;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, proposalStatus: 'applying' } : it)));

    const error = await executeProposal(item.proposal, { days, savePlan: save });

    if (error) {
      setItems((prev) => prev.map((it, i) =>
        i === index ? { ...it, proposalStatus: 'error', proposalError: error } : it,
      ));
      return;
    }
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, proposalStatus: 'done' } : it)));
    const confirmation: ChatMessage = { role: 'assistant', content: '✓ Hecho. Lo tienes en Historial.' };
    setItems((prev) => [...prev, confirmation]);
    await persist(confirmation);
    refresh();
  }, [items, days, save, persist, refresh]);

  // ── Editar propuesta → formulario pre-rellenado ─────────────────────────────
  const handleEdit = useCallback((index: number) => {
    const p = items[index]?.proposal;
    if (!p || (p.action !== 'log_session' && p.action !== 'edit_session')) return;
    router.push({
      pathname: '/log/[day]',
      params: { day: dayKey, prefill: JSON.stringify(p.args), date: p.args.session_date },
    });
  }, [items, dayKey]);

  const greeting = buildGreeting(planToday ?? null, weekNumber, getPhaseLabel(weekNumber), recentSessions[0] ?? null);
  const showChips = !items.some((i) => i.role === 'user');

  if (initializing) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={[s.weekChip, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                <Text style={[s.weekChipText, { color: colors.text3 }]}>
                  Semana {weekNumber} · {getPhaseLabel(weekNumber)}
                </Text>
              </View>
              <MessageBubble role="assistant" content={greeting} />
              {showChips && (
                <ActionChips
                  micSupported={recorder.supported}
                  onRecord={() => { void recorder.start(); }}
                  onManualLog={() => router.push({ pathname: '/log/[day]', params: { day: dayKey } })}
                  onViewPlan={() => router.push({ pathname: '/plan/[day]', params: { day: dayKey } })}
                />
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <MessageBubble role={item.role} content={item.content}>
              {item.proposal && (
                <ProposalCard
                  proposal={item.proposal}
                  status={item.proposalStatus ?? 'idle'}
                  error={item.proposalError}
                  onConfirm={() => handleConfirm(index)}
                  onEdit={
                    item.proposal.action === 'log_session' || item.proposal.action === 'edit_session'
                      ? () => handleEdit(index)
                      : undefined
                  }
                />
              )}
            </MessageBubble>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {busy && (
          <View style={s.typing}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[s.typingText, { color: colors.text3 }]}>{busyLabel}</Text>
          </View>
        )}

        <CoachInput onSendText={sendToCoach} onSendAudio={handleAudio} busy={busy} recorder={recorder} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.lg, paddingBottom: Spacing.gapSm },
  weekChip: {
    alignSelf: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs,
    marginBottom: Spacing.base,
  },
  weekChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.gapSm,
    gap: Spacing.gapSm,
  },
  typingText: { fontSize: FontSize.md },
});
```

**Nota de implementación:** en `sendToCoach` el primer mensaje debe ir con `role: 'system'`. `ChatMessage` solo admite `'user' | 'assistant'` — amplía el tipo en `types/index.ts` a `role: 'user' | 'assistant' | 'system'` (el proxy lo reenvía tal cual y el chat existente no se ve afectado), y simplifica la llamada a:

```ts
const reply = await askCoach([
  { role: 'system', content: systemPrompt },
  ...historyMessages,
]);
```

Haz ese cambio en `types/index.ts` (`ChatMessage.role`) como parte de este task y elimina el `.map` con cast del ejemplo anterior — la versión final debe ser la simple.

- [ ] **Step 2: Icono ☀️ en `app/(tabs)/_layout.tsx`**

En el `Tabs.Screen name="hoy"`, cambiar:

```tsx
      <Tabs.Screen
        name="hoy"
        options={{
          title: 'Hoy',
          headerTitle: 'Hoy',
          tabBarIcon: ({ color }) => <TabIcon name="sunny" color={color} />,
        }}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Prueba manual rápida en local**

Run: `npx expo start --web` y abrir la pestaña Hoy.
Expected: saludo del coach con la sesión del día, chips visibles, input con micro. Enviar un texto tipo «hoy he corrido 40 min suaves, RPE 5» debe (con key de Groq configurada) devolver una tarjeta de propuesta.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/hoy.tsx" "app/(tabs)/_layout.tsx" types/index.ts
git commit -m "feat: conversational Hoy home with voice coach and action proposals"
```

---

### Task 13: Formulario adaptativo — `app/log/[day].tsx` + MetricFields

**Files:**
- Create: `components/training/SubtypePicker.tsx`
- Create: `components/training/RunningFields.tsx`
- Create: `components/training/SwimFields.tsx`
- Create: `components/training/GymFields.tsx`
- Modify: `app/log/[day].tsx`

- [ ] **Step 1: Crear `components/training/SubtypePicker.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SUBTYPE_LABELS, SUBTYPES_BY_GROUP } from '../../constants/trainingPlan';
import type { SessionSubtype, SportGroup } from '../../types';

interface SubtypePickerProps {
  group: SportGroup;
  value: SessionSubtype | null;
  onChange: (v: SessionSubtype) => void;
  accentColor: string;
}

export function SubtypePicker({ group, value, onChange, accentColor }: SubtypePickerProps) {
  const { colors } = useTheme();
  const options = SUBTYPES_BY_GROUP[group];
  if (options.length <= 1) return null;

  return (
    <View style={s.block}>
      <Text style={[s.label, { color: colors.text3 }]}>TIPO DE SESIÓN</Text>
      <View style={s.row}>
        {options.map((sub) => {
          const active = sub === value;
          return (
            <TouchableOpacity
              key={sub}
              style={[
                s.chip,
                {
                  backgroundColor: active ? accentColor : colors.glassBg,
                  borderColor: active ? accentColor : colors.border,
                },
              ]}
              onPress={() => onChange(sub)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, { color: active ? '#fff' : colors.text3 }]}>
                {SUBTYPE_LABELS[sub]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapSm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm },
  chip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});
```

- [ ] **Step 2: Crear `components/training/RunningFields.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';
import { Input } from '../ui/Input';
import type { SessionMetrics } from '../../types';

interface RunningFieldsProps {
  metrics: SessionMetrics;
  durationMin: number;
  onChange: (m: SessionMetrics) => void;
}

// Ritmo mm:ss/km calculado de duración+distancia; editable a mano después.
export function computePace(durationMin: number, distanciaKm: number): string {
  if (!durationMin || !distanciaKm) return '';
  const secPerKm = (durationMin * 60) / distanciaKm;
  const mm = Math.floor(secPerKm / 60);
  const ss = Math.round(secPerKm % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export function RunningFields({ metrics, durationMin, onChange }: RunningFieldsProps) {
  const { colors } = useTheme();

  function setNum(key: 'distancia_km' | 'fc_media' | 'fc_max', raw: string) {
    const v = raw.replace(',', '.');
    const n = v === '' ? undefined : Number(v);
    const next = { ...metrics, [key]: n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined };
    if (key === 'distancia_km' && next.distancia_km) {
      next.ritmo_min_km = computePace(durationMin, next.distancia_km);
    }
    onChange(next);
  }

  return (
    <View style={s.block}>
      <View style={s.row}>
        <Input
          label="Distancia (km)"
          value={metrics.distancia_km?.toString() ?? ''}
          onChangeText={(v) => setNum('distancia_km', v)}
          keyboardType="decimal-pad"
          placeholder="12.5"
          containerStyle={s.half}
        />
        <Input
          label="Ritmo (min/km)"
          value={metrics.ritmo_min_km ?? ''}
          onChangeText={(v) => onChange({ ...metrics, ritmo_min_km: v || undefined })}
          placeholder="4:35"
          containerStyle={s.half}
        />
      </View>
      <View style={s.row}>
        <Input
          label="FC media"
          value={metrics.fc_media?.toString() ?? ''}
          onChangeText={(v) => setNum('fc_media', v)}
          keyboardType="number-pad"
          placeholder="152"
          containerStyle={s.half}
        />
        <Input
          label="FC máx"
          value={metrics.fc_max?.toString() ?? ''}
          onChangeText={(v) => setNum('fc_max', v)}
          keyboardType="number-pad"
          placeholder="176"
          containerStyle={s.half}
        />
      </View>
      {!!metrics.distancia_km && !!metrics.ritmo_min_km && (
        <Text style={[s.hint, { color: colors.text3 }]}>
          Ritmo autocalculado con la duración — edítalo si tu reloj dice otra cosa.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapMd },
  row: { flexDirection: 'row', gap: Spacing.gapMd },
  half: { flex: 1 },
  hint: { fontSize: FontSize.sm, fontStyle: 'italic' },
});
```

- [ ] **Step 3: Crear `components/training/SwimFields.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Input } from '../ui/Input';
import type { SessionMetrics, SwimSet } from '../../types';

interface SwimFieldsProps {
  metrics: SessionMetrics;
  onChange: (m: SessionMetrics) => void;
}

export function SwimFields({ metrics, onChange }: SwimFieldsProps) {
  const { colors } = useTheme();
  const sets = metrics.series ?? [];

  function setMetros(raw: string) {
    const n = raw === '' ? undefined : Number(raw);
    onChange({ ...metrics, metros: n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined });
  }

  function updateSet(i: number, patch: Partial<SwimSet>) {
    const next = sets.map((st, idx) => (idx === i ? { ...st, ...patch } : st));
    onChange({ ...metrics, series: next });
  }

  function addSet() {
    onChange({ ...metrics, series: [...sets, { reps: 4, distancia_m: 100 }] });
  }

  function removeSet(i: number) {
    const next = sets.filter((_, idx) => idx !== i);
    onChange({ ...metrics, series: next.length ? next : undefined });
  }

  return (
    <View style={s.block}>
      <Input
        label="Metros totales"
        value={metrics.metros?.toString() ?? ''}
        onChangeText={setMetros}
        keyboardType="number-pad"
        placeholder="2000"
      />
      <Text style={[s.label, { color: colors.text3 }]}>SERIES</Text>
      {sets.map((st, i) => (
        <View key={i} style={s.setRow}>
          <Input
            value={st.reps.toString()}
            onChangeText={(v) => updateSet(i, { reps: Number(v) || 1 })}
            keyboardType="number-pad"
            containerStyle={s.tiny}
          />
          <Text style={[s.x, { color: colors.text3 }]}>×</Text>
          <Input
            value={st.distancia_m.toString()}
            onChangeText={(v) => updateSet(i, { distancia_m: Number(v) || 25 })}
            keyboardType="number-pad"
            containerStyle={s.tiny}
          />
          <Text style={[s.x, { color: colors.text3 }]}>m</Text>
          <Input
            value={st.descripcion ?? ''}
            onChangeText={(v) => updateSet(i, { descripcion: v || undefined })}
            placeholder="técnica, pull…"
            containerStyle={s.desc}
          />
          <TouchableOpacity onPress={() => removeSet(i)} hitSlop={8}>
            <Text style={[s.remove, { color: colors.danger }]}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={[s.addBtn, { borderColor: colors.border }]}
        onPress={addSet}
        activeOpacity={0.75}
      >
        <Text style={[s.addText, { color: colors.accent }]}>+ Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapMd },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.gapSm },
  tiny: { width: 58 },
  desc: { flex: 1 },
  x: { fontSize: FontSize.md },
  remove: { fontSize: FontSize.body, paddingHorizontal: Spacing.gapXs },
  addBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.gapSm,
    alignItems: 'center',
  },
  addText: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
});
```

- [ ] **Step 4: Crear `components/training/GymFields.tsx`**

El checklist de ejercicios ya existe en el formulario; esto añade los kg reales por ejercicio completado.

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Input } from '../ui/Input';
import type { ExerciseTemplate, GymExerciseMetric } from '../../types';

interface GymFieldsProps {
  exercises: ExerciseTemplate[];         // ejercicios del plan del día
  completedIds: Set<string>;             // los marcados como hechos
  values: GymExerciseMetric[];           // metrics.ejercicios actual
  onChange: (v: GymExerciseMetric[]) => void;
}

export function GymFields({ exercises, completedIds, values, onChange }: GymFieldsProps) {
  const { colors } = useTheme();
  const done = exercises.filter((e) => completedIds.has(e.id));
  if (done.length === 0) return null;

  function kgFor(name: string): string {
    return values.find((v) => v.nombre === name)?.kg?.toString() ?? '';
  }

  function setKg(ex: ExerciseTemplate, raw: string) {
    const n = raw === '' ? undefined : Number(raw.replace(',', '.'));
    const kg = n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;
    const rest = values.filter((v) => v.nombre !== ex.name);
    const entry: GymExerciseMetric = {
      nombre: ex.name,
      series: ex.sets ?? 1,
      reps: ex.reps ?? '-',
      ...(kg !== undefined ? { kg } : {}),
    };
    onChange([...rest, entry]);
  }

  return (
    <View style={s.block}>
      <Text style={[s.label, { color: colors.text3 }]}>CARGAS REALES (KG)</Text>
      {done.map((ex) => (
        <View key={ex.id} style={s.row}>
          <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
          <Input
            value={kgFor(ex.name)}
            onChangeText={(v) => setKg(ex, v)}
            keyboardType="decimal-pad"
            placeholder={ex.load ?? 'kg'}
            containerStyle={s.kg}
          />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapSm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.gapMd },
  name: { flex: 1, fontSize: FontSize.md },
  kg: { width: 90 },
});
```

- [ ] **Step 5: Modificar `app/log/[day].tsx`**

Cambios concretos (mantener el resto del archivo igual):

1. **Imports nuevos** (junto a los existentes):

```ts
import { SUBTYPES_BY_GROUP, sportGroupOf } from '../../constants/trainingPlan';
import { SessionSubtype, SessionMetrics, GymExerciseMetric } from '../../types';
import { SubtypePicker } from '../../components/training/SubtypePicker';
import { RunningFields } from '../../components/training/RunningFields';
import { SwimFields } from '../../components/training/SwimFields';
import { GymFields } from '../../components/training/GymFields';
```

2. **Params ampliados** (línea 170):

```ts
const { day, done, prefill, date } = useLocalSearchParams<{ day: string; done?: string; prefill?: string; date?: string }>();
```

3. **Estado nuevo** (tras `const [notes, setNotes]`, con prefill del coach):

```ts
const group = plan ? sportGroupOf(plan.sessionType) : 'other';
const [subtype, setSubtype] = useState<SessionSubtype | null>(() => SUBTYPES_BY_GROUP[group][0] ?? null);
const [metrics, setMetrics] = useState<SessionMetrics>({});
const [duration, setDuration] = useState<number>(plan?.duration ?? 0);

// Prefill desde una propuesta del coach (botón «Editar» de la tarjeta).
useEffect(() => {
  if (!prefill) return;
  try {
    const p = JSON.parse(prefill) as {
      subtype?: SessionSubtype; duration_min?: number; rpe?: number;
      fatigue?: number; notes?: string; metrics?: SessionMetrics;
    };
    if (p.subtype) setSubtype(p.subtype);
    if (p.duration_min) setDuration(p.duration_min);
    if (p.rpe) setRpe(p.rpe);
    if (p.fatigue) setFatigue(p.fatigue);
    if (p.notes) setNotes(p.notes);
    if (p.metrics) setMetrics(p.metrics);
  } catch { /* prefill malformado → formulario limpio */ }
}, [prefill]);
```

(Añadir `useEffect` al import de React.)

4. **Fecha de la sesión** — en `handleSave`, sustituir `const today = ...` por:

```ts
const sessionDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  ? date
  : new Date().toISOString().split('T')[0];
```

y usar `sessionDate` en las dos queries donde ahora se usa `today`.

5. **Campos guardados** — en `fields`, cambiar `duration_min: plan.duration,` por `duration_min: duration || plan.duration,` y añadir:

```ts
subtype,
metrics: Object.keys(metrics).length ? metrics : null,
```

6. **JSX nuevo** — entre el bloque de ejercicios y el de RPE/fatiga, dentro del render `!savedSessionId`:

```tsx
{!savedSessionId && (
  <SubtypePicker group={group} value={subtype} onChange={setSubtype} accentColor={accentColor} />
)}

{!savedSessionId && (
  <Input
    label="Duración (min)"
    value={duration ? duration.toString() : ''}
    onChangeText={(v) => setDuration(Number(v) || 0)}
    keyboardType="number-pad"
    placeholder={`${plan.duration}`}
  />
)}

{!savedSessionId && group === 'run' && (
  <RunningFields metrics={metrics} durationMin={duration || plan.duration} onChange={setMetrics} />
)}
{!savedSessionId && group === 'swim' && (
  <SwimFields metrics={metrics} onChange={setMetrics} />
)}
{!savedSessionId && group === 'gym' && plan.exercises && (
  <GymFields
    exercises={plan.exercises}
    completedIds={completed}
    values={metrics.ejercicios ?? []}
    onChange={(ejercicios) => setMetrics({ ...metrics, ejercicios: ejercicios.length ? ejercicios : undefined })}
  />
)}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 7: Prueba manual**

`npx expo start --web` → Hoy → chip «✍️ Registrar»: el formulario debe mostrar el selector de subtipo y los campos del deporte del día (lunes = running → distancia/ritmo/FC).

- [ ] **Step 8: Commit**

```bash
git add components/training/ "app/log/[day].tsx"
git commit -m "feat: adaptive session form with per-sport metrics and coach prefill"
```

---

### Task 14: Pulido visual — Historial (chips de métricas) + Semana (dots de progreso)

**Files:**
- Modify: `app/(tabs)/historial.tsx:117-134` (chips) y `:15` (imports)
- Modify: `app/(tabs)/semana.tsx:44-63` (dots) y `:17` (imports)

- [ ] **Step 1: Chips de métricas en `historial.tsx`**

Import: añadir `SUBTYPE_LABELS` al import de `constants/trainingPlan` existente.

En `SessionCard`, dentro de `<View style={s.chips}>`, tras el chip de fatiga y antes del chip «Más/Menos», añadir:

```tsx
          {session.subtype && (
            <Chip label={SUBTYPE_LABELS[session.subtype]} color={colors.text2} bg={colors.border} />
          )}
          {session.metrics?.distancia_km != null && (
            <Chip label={`${session.metrics.distancia_km} km`} color={barColor} bg={barColor + '1A'} />
          )}
          {session.metrics?.ritmo_min_km && (
            <Chip label={`${session.metrics.ritmo_min_km}/km`} color={barColor} bg={barColor + '1A'} />
          )}
          {session.metrics?.metros != null && (
            <Chip label={`${session.metrics.metros} m`} color={barColor} bg={barColor + '1A'} />
          )}
          {session.metrics?.fc_media != null && (
            <Chip label={`FC ${session.metrics.fc_media}`} color={colors.text3} bg={colors.border} />
          )}
          {session.metrics?.ejercicios?.some((e) => e.kg != null) && (
            <Chip
              label={`máx ${Math.max(...session.metrics.ejercicios.filter((e) => e.kg != null).map((e) => e.kg as number))} kg`}
              color={colors.text3}
              bg={colors.border}
            />
          )}
```

- [ ] **Step 2: Dots de progreso semanal en `semana.tsx`**

Imports: añadir `useWeekSessions` al import de `../../hooks/useTraining`.

En `SemanaScreen`, tras `const { days } = usePlan();` añadir:

```ts
const { sessions: weekSessions } = useWeekSessions();
const loggedDays = new Set(weekSessions.map((s) => s.day_name.toLowerCase()));
```

Tras el `weekHeader` (antes del botón «Editar plan»), añadir el strip de progreso:

```tsx
        <View style={s.progressStrip}>
          {days.map((d) => {
            const isDone = loggedDays.has(d.dayName.toLowerCase());
            const isToday = d.day === todayKey;
            return (
              <View
                key={d.day}
                style={[
                  s.progressDot,
                  {
                    backgroundColor: isDone
                      ? (SessionColors[d.sessionType] ?? colors.accent)
                      : colors.border,
                    borderWidth: isToday ? 2 : 0,
                    borderColor: colors.accent,
                  },
                ]}
              />
            );
          })}
        </View>
```

Y en los estilos:

```ts
  progressStrip: { flexDirection: 'row', gap: Spacing.gapSm, marginBottom: Spacing.lg },
  progressDot: { flex: 1, height: 6, borderRadius: 3 },
```

- [ ] **Step 3: Typecheck, prueba visual en los tres temas y commit**

```bash
npx tsc --noEmit
```
Prueba manual: `npx expo start --web`, cambiar tema desde el menú de cuenta (dark/white/nude) y revisar Historial y Semana.

```bash
git add "app/(tabs)/historial.tsx" "app/(tabs)/semana.tsx"
git commit -m "polish: metric chips in history + weekly progress strip"
```

---

### Task 15: Deploy + verificación E2E

**Files:** ninguno nuevo (deploy + checklist)

- [ ] **Step 1: Suite completa en local**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: ambos exit 0.

- [ ] **Step 2: Build web local**

```bash
npx expo export -p web
```
Expected: `dist/` regenerado sin errores.

- [ ] **Step 3: Deploy a Vercel**

```bash
git push origin main
npx vercel --prod
```
Nota: si `npx vercel` falla con EACCES en la caché de npm, el usuario debe ejecutar antes: `! sudo chown -R $(whoami) ~/.npm`. Las env vars `EXPO_PUBLIC_*` ya están configuradas en el proyecto de Vercel (el deploy actual funciona con ellas).

- [ ] **Step 4: Verificar endpoints desplegados**

```bash
BASE="https://training-app-delta-self.vercel.app"
curl -s -w "\n%{http_code}\n" -X POST "$BASE/api/transcribe" -H "Content-Type: application/json" -d '{}'
curl -s -w "\n%{http_code}\n" -X POST "$BASE/api/coach" -H "Content-Type: application/json" -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/coach"
```
Expected: `401 {"error":"No autorizado"}`, `401 {"error":"No autorizado"}`, `405`.

- [ ] **Step 5: E2E manual en el deploy (usuario o navegador controlado)**

Checklist (spec §8):
1. Login → pestaña Hoy muestra saludo contextual + chips + ☀️ en la tab bar.
2. Grabar audio real: «hoy he corrido 55 minutos, RPE 7, piernas algo cargadas» → aparece transcrito como mensaje propio → tarjeta de propuesta con Running, 55 min, RPE 7.
3. Confirmar → «✓ Hecho» → la sesión aparece en Historial con sus chips de métricas.
4. Verificar en Supabase (Table editor) que `training_sessions` tiene `subtype`/`metrics` y `user_id` propio.
5. «Editar» en una propuesta → formulario pre-relleno.
6. Pedir por texto «cámbiame la tirada larga al domingo» → tarjeta adjust_plan → Confirmar → Semana refleja el cambio.
7. Pedir «borra la sesión de ayer» → tarjeta roja delete → Confirmar → desaparece de Historial.
8. Con un usuario SIN key de Groq: el envío muestra el CTA de Ajustes.
9. Probar los tres temas en la home nueva.

- [ ] **Step 6: Commit final si hubo fixes**

```bash
git add -A && git commit -m "fix: E2E adjustments after deploy verification"
```

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec:** §1 datos → Task 2; §2 servidor → Tasks 7-8; §3 home → Tasks 5, 9-12; §4 formulario → Task 13; §5 refactor → Tasks 4-5 (extracciones DRY; `chat/[id].tsx` y `log/[day].tsx` quedan más pequeños); §6 visual → Tasks 12-14; §7 errores → manejados en `reply.ts` (degradación), `ProposalCard` (reintento), `api.ts` (mensajes NO_GROQ_KEY/AUDIO_TOO_LARGE), `hoy.tsx` (transcripción fallida); §8 verificación → Task 15.
- **Sin placeholders:** todos los pasos llevan código o comandos completos. La única referencia «verbatim» es el traslado de `buildSystemPrompt` (Task 5), que copia código existente del repo con ubicación exacta.
- **Consistencia de tipos:** `ActionProposal`/`CoachReply` (Task 3) se usan idénticos en Tasks 6, 8, 9, 10, 11, 12. `ChatMessage.role` amplía a `'system'` en Task 12 y `lib/coach/api.ts` lo acepta por tipado estructural. `SUBTYPE_LABELS`/`sportGroupOf` (Task 2) se usan en Tasks 11, 13, 14.

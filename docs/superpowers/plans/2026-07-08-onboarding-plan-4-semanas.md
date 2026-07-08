# Onboarding con encuesta + plan de 4 semanas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encuesta de onboarding (deportes, objetivo, evento, disponibilidad, nivel) que genera localmente un plan de 4 semanas progresivas y lo guarda como `plan_data` v2, con guard automático para usuarios sin plan y relanzado desde la pantalla Plan.

**Architecture:** Generador composicional puro en `lib/planGenerator/` (scheduler reparte días → biblioteca construye `DayPlan` desde `SESSION_DEFAULTS` existente → progresión ×4 semanas). `plan_data` pasa a `{ version: 2, profile, weeks }` (jsonb, sin migración SQL); `PlanContext` normaliza el formato legacy en memoria y expone semanas + semana seleccionada. Wizard en `app/onboarding.tsx`.

**Tech Stack:** React Native + Expo Router + TypeScript estricto, Supabase (tabla `training_plans` existente), vitest para módulos puros.

**Spec:** `docs/superpowers/specs/2026-07-08-onboarding-plan-design.md`

**Convenciones del repo (leer antes de empezar):**
- TypeScript estricto, sin `any`. Tipos compartidos en `types/index.ts`.
- Textos de UI en español, código en inglés. Comentarios solo para WHY no evidente.
- Estilos con `StyleSheet.create()` al final del archivo.
- Tests solo de módulos puros (sin react-native) en `tests/`, corren con `npm test` (vitest, environment node). La UI se verifica con `npx tsc --noEmit`.
- Commits frecuentes, mensajes en español estilo `feat:`/`fix:`/`test:`.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `types/index.ts` | Modificar | Tipos `SportChoice`, `OnboardingGoal`, `RaceDistanceChoice`, `ExperienceLevel`, `OnboardingAnswers`, `PlanDataV2` |
| `lib/planGenerator/progression.ts` | Crear | Escalado de volumen (nivel y semana) + `buildWeeks` |
| `lib/planGenerator/scheduler.ts` | Crear | Reparto de días entre deportes según objetivo |
| `lib/planGenerator/library.ts` | Crear | `DayPlan` desde `SESSION_DEFAULTS` + factor de nivel |
| `lib/planGenerator/generate.ts` | Crear | Orquestador `generatePlan(answers)` |
| `lib/training/planData.ts` | Crear | Normalización legacy→v2, semana actual, plan por defecto |
| `lib/PlanContext.tsx` | Modificar | API v2: `weeks`, `weekIndex`, `hasPlan`, `replacePlan` |
| `app/_layout.tsx` | Modificar | Guard: sin plan → `/onboarding` |
| `app/onboarding.tsx` | Crear | Wizard de 5 pasos |
| `app/(tabs)/semana.tsx` | Modificar | Selector de semanas + banner plan completado |
| `app/(tabs)/hoy.tsx` | Modificar | Días de la semana actual + chip de semana |
| `app/plan/index.tsx` | Modificar | Botón «Rehacer encuesta» |
| `tests/planGenerator/*.test.ts` | Crear | Tests del generador |
| `tests/training/planData.test.ts` | Crear | Tests de normalización y semana actual |

---

### Task 1: Tipos de onboarding y plan v2

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Añadir los tipos al final de `types/index.ts`**

Añadir al final del archivo (tras el bloque de Agenda):

```ts
// ─── Onboarding y plan v2 ─────────────────────────────────────────────────────

export type SportChoice = 'run' | 'swim' | 'gym' | 'hyrox';

export type OnboardingGoal = 'race' | 'general_fitness' | 'lose_weight' | 'gain_strength';

export type RaceDistanceChoice = '5k' | '10k' | 'half' | 'marathon' | 'hyrox';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface OnboardingAnswers {
  sports: SportChoice[];
  goal: OnboardingGoal;
  raceDistance?: RaceDistanceChoice;
  raceDate?: string; // ISO yyyy-mm-dd
  daysPerWeek: number; // 3-7
  level: ExperienceLevel;
}

// plan_data v2: objeto con perfil + 4 semanas. El formato legacy (DayPlan[])
// se normaliza en memoria en lib/training/planData.ts.
export interface PlanDataV2 {
  version: 2;
  profile: OnboardingAnswers | null;
  weeks: WeekPlan[];
}
```

- [ ] **Step 2: Actualizar `TrainingPlan.plan_data` para reflejar la realidad**

En `types/index.ts`, en la interfaz `TrainingPlan` (línea ~98), cambiar:

```ts
  plan_data: WeekPlan[];
```

por:

```ts
  plan_data: PlanDataV2 | DayPlan[]; // DayPlan[] = formato legacy pre-onboarding
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: tipos de onboarding y plan_data v2"
```

---

### Task 2: Progresión y escalado (`lib/planGenerator/progression.ts`)

**Files:**
- Create: `lib/planGenerator/progression.ts`
- Test: `tests/planGenerator/progression.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/planGenerator/progression.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildWeeks,
  scaleDayPlan,
  scaleDistance,
  scaleDuration,
  scaleExercise,
} from '../../lib/planGenerator/progression';
import type { DayPlan } from '../../types';

const day: DayPlan = {
  day: 'monday',
  dayName: 'Lunes',
  sessionType: 'running_threshold',
  title: 'Umbral',
  duration: 60,
  description: 'test',
  exercises: [
    { id: 'a', name: 'Series', sets: 4, duration: '8 min', rest: '2 min' },
    { id: 'b', name: 'Rodaje', duration: '75-90 min' },
    { id: 'c', name: 'Técnica', distance: '100m' },
    { id: 'd', name: 'Fuerza', sets: 3, reps: '8 por lado', load: '60-80% 1RM' },
  ],
};

describe('scaleDuration', () => {
  it('escala minutos con redondeo a entero por debajo de 20', () => {
    expect(scaleDuration('8 min', 1.1)).toBe('9 min');
  });
  it('escala rangos a múltiplos de 5 a partir de 20', () => {
    expect(scaleDuration('75-90 min', 1.2)).toBe('90-110 min');
  });
  it('deja intacto lo no parseable', () => {
    expect(scaleDuration('hasta fallo', 1.2)).toBe('hasta fallo');
  });
});

describe('scaleDistance', () => {
  it('escala metros a múltiplos de 25', () => {
    expect(scaleDistance('100m', 1.2)).toBe('125m');
    expect(scaleDistance('100m', 0.8)).toBe('75m');
  });
  it('deja intacto lo no parseable', () => {
    expect(scaleDistance('2 largos', 1.2)).toBe('2 largos');
  });
});

describe('scaleExercise', () => {
  it('escala sets a enteros >= 1', () => {
    expect(scaleExercise(day.exercises![0], 0.6).sets).toBe(2);
    expect(scaleExercise({ id: 'x', name: 'x', sets: 1 }, 0.6).sets).toBe(1);
  });
  it('no toca reps ni load', () => {
    const scaled = scaleExercise(day.exercises![3], 1.2);
    expect(scaled.reps).toBe('8 por lado');
    expect(scaled.load).toBe('60-80% 1RM');
  });
});

describe('scaleDayPlan', () => {
  it('escala la duración total a múltiplos de 5', () => {
    expect(scaleDayPlan(day, 1.2).duration).toBe(70);
  });
  it('con factor 1 devuelve el día tal cual', () => {
    expect(scaleDayPlan(day, 1)).toBe(day);
  });
  it('no toca los días de descanso', () => {
    const rest: DayPlan = { ...day, sessionType: 'rest', duration: 0, exercises: [] };
    expect(scaleDayPlan(rest, 1.2)).toBe(rest);
  });
});

describe('buildWeeks', () => {
  it('genera 4 semanas con foco y descarga final', () => {
    const weeks = buildWeeks([day]);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(weeks[3].focus).toBe('Descarga');
    const setsOf = (i: number) => weeks[i].days[0].exercises![0].sets!;
    expect(setsOf(3)).toBeLessThan(setsOf(0));
    expect(setsOf(2)).toBeGreaterThanOrEqual(setsOf(0));
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run tests/planGenerator/progression.test.ts`
Expected: FAIL — no existe `lib/planGenerator/progression.ts`.

- [ ] **Step 3: Implementar `lib/planGenerator/progression.ts`**

```ts
import type { DayPlan, ExerciseTemplate, WeekPlan } from '../../types';

// Solo se escalan volúmenes con formato conocido ("8 min", "75-90 min", "100m");
// cargas ("60-80% 1RM") y reps ("8 por lado") se dejan intactas a propósito.
const DURATION_RE = /^(\d+)\s*(?:-\s*(\d+))?\s*min$/i;
const DISTANCE_RE = /^(\d+)\s*m$/i;

function roundMin(n: number): number {
  const rounded = n >= 20 ? Math.round(n / 5) * 5 : Math.round(n);
  return Math.max(1, rounded);
}

function roundMeters(n: number): number {
  return Math.max(25, Math.round(n / 25) * 25);
}

export function scaleDuration(value: string, factor: number): string {
  const m = value.match(DURATION_RE);
  if (!m) return value;
  const lo = roundMin(Number(m[1]) * factor);
  if (!m[2]) return `${lo} min`;
  return `${lo}-${roundMin(Number(m[2]) * factor)} min`;
}

export function scaleDistance(value: string, factor: number): string {
  const m = value.match(DISTANCE_RE);
  if (!m) return value;
  return `${roundMeters(Number(m[1]) * factor)}m`;
}

export function scaleExercise(ex: ExerciseTemplate, factor: number): ExerciseTemplate {
  return {
    ...ex,
    ...(ex.sets != null ? { sets: Math.max(1, Math.round(ex.sets * factor)) } : {}),
    ...(ex.duration ? { duration: scaleDuration(ex.duration, factor) } : {}),
    ...(ex.distance ? { distance: scaleDistance(ex.distance, factor) } : {}),
  };
}

export function scaleDayPlan(day: DayPlan, factor: number): DayPlan {
  if (factor === 1 || day.sessionType === 'rest') return day;
  return {
    ...day,
    duration: Math.max(5, Math.round((day.duration * factor) / 5) * 5),
    exercises: (day.exercises ?? []).map((ex) => scaleExercise(ex, factor)),
  };
}

const WEEK_FACTORS = [1, 1.1, 1.2, 0.6] as const;
const WEEK_FOCUS = ['Adaptación', 'Progresión', 'Carga máxima', 'Descarga'] as const;

export function buildWeeks(baseDays: DayPlan[]): WeekPlan[] {
  return WEEK_FACTORS.map((factor, i) => ({
    week: i + 1,
    phase: 'base' as const,
    focus: WEEK_FOCUS[i],
    days: baseDays.map((d) => scaleDayPlan(d, factor)),
  }));
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run tests/planGenerator/progression.test.ts`
Expected: PASS (todos los tests).

- [ ] **Step 5: Commit**

```bash
git add lib/planGenerator/progression.ts tests/planGenerator/progression.test.ts
git commit -m "feat: escalado de volumen y progresión de 4 semanas"
```

---

### Task 3: Scheduler (`lib/planGenerator/scheduler.ts`)

**Files:**
- Create: `lib/planGenerator/scheduler.ts`
- Test: `tests/planGenerator/scheduler.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/planGenerator/scheduler.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scheduleWeek, sessionCounts } from '../../lib/planGenerator/scheduler';
import type { OnboardingAnswers, SessionType } from '../../types';

const HARD: SessionType[] = ['running_intervals', 'running_threshold', 'hyrox_simulation'];

function answers(partial: Partial<OnboardingAnswers>): OnboardingAnswers {
  return {
    sports: ['run'],
    goal: 'general_fitness',
    daysPerWeek: 4,
    level: 'intermediate',
    ...partial,
  };
}

describe('sessionCounts', () => {
  it('objetivo carrera prioriza el deporte de la carrera', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'gym'], goal: 'race', raceDistance: 'half' }), 5);
    expect(counts.get('run')).toBe(3);
    expect(counts.get('gym')).toBe(2);
  });
  it('ganar fuerza prioriza gimnasio', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'gym'], goal: 'gain_strength' }), 4);
    expect(counts.get('gym')!).toBeGreaterThan(counts.get('run')!);
  });
  it('garantiza 1 día por deporte cuando caben todos', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'swim', 'gym', 'hyrox'], goal: 'race', raceDistance: 'half' }), 4);
    for (const sport of ['run', 'swim', 'gym', 'hyrox'] as const) {
      expect(counts.get(sport)!).toBeGreaterThanOrEqual(1);
    }
  });
  it('si no caben todos, gana el de más peso', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'swim', 'gym', 'hyrox'], goal: 'gain_strength' }), 2);
    expect(counts.get('gym')).toBe(1);
    expect(counts.get('hyrox')).toBe(1);
    expect(counts.get('run')).toBe(0);
    expect(counts.get('swim')).toBe(0);
  });
});

describe('scheduleWeek', () => {
  it('devuelve 7 días con tantas sesiones activas como días pedidos', () => {
    for (const daysPerWeek of [3, 4, 5, 6, 7]) {
      const week = scheduleWeek(answers({ sports: ['run', 'gym'], daysPerWeek }));
      expect(week).toHaveLength(7);
      expect(week.filter((s) => s !== 'rest')).toHaveLength(daysPerWeek);
    }
  });

  it('todos los deportes elegidos aparecen cuando caben', () => {
    const week = scheduleWeek(answers({ sports: ['run', 'swim', 'gym', 'hyrox'], daysPerWeek: 5 }));
    expect(week).toContain('swimming');
    expect(week).toContain('gym_strength');
    expect(week.some((s) => s.startsWith('running'))).toBe(true);
    expect(week.some((s) => s === 'gym_hyrox' || s === 'hyrox_simulation')).toBe(true);
  });

  it('con 6-7 días hay recuperación activa en domingo', () => {
    const week = scheduleWeek(answers({ sports: ['run'], daysPerWeek: 7 }));
    expect(week[6]).toBe('active_recovery');
  });

  it('la tirada larga cae en sábado si hay running con 2+ días', () => {
    const week = scheduleWeek(answers({ sports: ['run'], daysPerWeek: 4, goal: 'race', raceDistance: 'half' }));
    expect(week[5]).toBe('running_long');
  });

  it('sin dos días duros consecutivos', () => {
    const combos: Array<Partial<OnboardingAnswers>> = [
      { sports: ['run'], daysPerWeek: 7, goal: 'race', raceDistance: 'half' },
      { sports: ['run', 'hyrox'], daysPerWeek: 6, goal: 'race', raceDistance: 'hyrox' },
      { sports: ['run', 'swim', 'gym', 'hyrox'], daysPerWeek: 7 },
      { sports: ['run', 'gym'], daysPerWeek: 5, goal: 'lose_weight' },
    ];
    for (const combo of combos) {
      const week = scheduleWeek(answers(combo));
      for (let i = 0; i < 6; i++) {
        const both = HARD.includes(week[i]) && HARD.includes(week[i + 1]);
        expect(both, `duros seguidos en ${JSON.stringify(combo)}: ${week.join(',')}`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run tests/planGenerator/scheduler.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Implementar `lib/planGenerator/scheduler.ts`**

```ts
import type { OnboardingAnswers, SessionType, SportChoice } from '../../types';

const HARD = new Set<SessionType>(['running_intervals', 'running_threshold', 'hyrox_simulation']);

function sportWeights(answers: OnboardingAnswers): Map<SportChoice, number> {
  const weights = new Map<SportChoice, number>();
  for (const sport of answers.sports) weights.set(sport, 1);

  if (answers.goal === 'lose_weight') {
    const table: Record<SportChoice, number> = { run: 2, swim: 2, hyrox: 1.5, gym: 1 };
    for (const sport of answers.sports) weights.set(sport, table[sport]);
  } else if (answers.goal === 'gain_strength') {
    const table: Record<SportChoice, number> = { gym: 3, hyrox: 2, run: 1, swim: 1 };
    for (const sport of answers.sports) weights.set(sport, table[sport]);
  } else if (answers.goal === 'race') {
    const raceSport: SportChoice = answers.raceDistance === 'hyrox' ? 'hyrox' : 'run';
    if (weights.has(raceSport)) weights.set(raceSport, 3);
  }
  return weights;
}

// Reparto por resto mayor: 1 día garantizado por deporte y el resto proporcional
// al peso del objetivo. Si no caben todos, ganan los de más peso (empate: orden
// en que el usuario los eligió — sort es estable).
export function sessionCounts(answers: OnboardingAnswers, total: number): Map<SportChoice, number> {
  const weights = sportWeights(answers);
  const sports = answers.sports;
  const counts = new Map<SportChoice, number>();

  if (total < sports.length) {
    const ranked = [...sports].sort((a, b) => weights.get(b)! - weights.get(a)!);
    ranked.slice(0, total).forEach((sp) => counts.set(sp, 1));
    sports.forEach((sp) => { if (!counts.has(sp)) counts.set(sp, 0); });
    return counts;
  }

  const weightSum = sports.reduce((acc, sp) => acc + weights.get(sp)!, 0);
  const spare = total - sports.length;
  const exact = sports.map((sp) => ({ sp, value: (spare * weights.get(sp)!) / weightSum }));
  exact.forEach(({ sp, value }) => counts.set(sp, 1 + Math.floor(value)));

  let assigned = [...counts.values()].reduce((a, b) => a + b, 0);
  // Desempate de restos iguales por peso: el deporte prioritario del objetivo
  // se lleva el día extra (p. ej. gain_strength con run+gym → gym).
  const byRemainder = [...exact].sort(
    (a, b) => (b.value % 1) - (a.value % 1) || weights.get(b.sp)! - weights.get(a.sp)!,
  );
  for (const { sp } of byRemainder) {
    if (assigned >= total) break;
    counts.set(sp, counts.get(sp)! + 1);
    assigned += 1;
  }
  return counts;
}

function runVariants(count: number): SessionType[] {
  if (count === 1) return ['running_easy'];
  if (count === 2) return ['running_easy', 'running_long'];
  if (count === 3) return ['running_easy', 'running_intervals', 'running_long'];
  return [
    'running_easy',
    'running_threshold',
    'running_intervals',
    'running_long',
    ...Array<SessionType>(count - 4).fill('running_easy'),
  ];
}

function hyroxVariants(count: number): SessionType[] {
  if (count === 1) return ['gym_hyrox'];
  return ['gym_hyrox', 'hyrox_simulation', ...Array<SessionType>(count - 2).fill('gym_hyrox')];
}

function variantsFor(sport: SportChoice, count: number): SessionType[] {
  if (count <= 0) return [];
  if (sport === 'run') return runVariants(count);
  if (sport === 'hyrox') return hyroxVariants(count);
  if (sport === 'swim') return Array<SessionType>(count).fill('swimming');
  return Array<SessionType>(count).fill('gym_strength');
}

export function buildSessionList(answers: OnboardingAnswers): SessionType[] {
  const daysPerWeek = Math.min(7, Math.max(3, answers.daysPerWeek));
  const withRecovery = daysPerWeek >= 6;
  const active = daysPerWeek - (withRecovery ? 1 : 0);
  const counts = sessionCounts(answers, active);
  const sessions = answers.sports.flatMap((sp) => variantsFor(sp, counts.get(sp) ?? 0));
  if (withRecovery) sessions.push('active_recovery');
  return sessions;
}

// Anclas fijas (recuperación domingo, tirada larga sábado) y días duros en
// días alternos para no encadenar dos duros. Los huecos restantes son descanso.
export function placeSessions(sessions: SessionType[]): SessionType[] {
  const slots: (SessionType | null)[] = Array(7).fill(null);
  const pool = [...sessions];
  const take = (type: SessionType): SessionType | null => {
    const i = pool.indexOf(type);
    return i >= 0 ? pool.splice(i, 1)[0] : null;
  };

  const recovery = take('active_recovery');
  if (recovery) slots[6] = recovery;
  const longRun = take('running_long');
  if (longRun) slots[5] = longRun;

  const isHard = (s: SessionType | null | undefined) => s != null && HARD.has(s);
  const hards = pool.filter((s) => HARD.has(s));
  const easies = pool.filter((s) => !HARD.has(s));

  for (const hard of hards) {
    const idx =
      [0, 2, 4, 1, 3].find((i) => slots[i] === null && !isHard(slots[i - 1]) && !isHard(slots[i + 1])) ??
      slots.findIndex((s) => s === null);
    if (idx >= 0) slots[idx] = hard;
  }
  for (const easy of easies) {
    const idx = [0, 2, 4, 1, 3, 5, 6].find((i) => slots[i] === null);
    if (idx !== undefined) slots[idx] = easy;
  }
  return slots.map((s) => s ?? 'rest');
}

// Semana tipo (lunes primero) a partir de las respuestas del onboarding.
export function scheduleWeek(answers: OnboardingAnswers): SessionType[] {
  return placeSessions(buildSessionList(answers));
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run tests/planGenerator/scheduler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/planGenerator/scheduler.ts tests/planGenerator/scheduler.test.ts
git commit -m "feat: scheduler de reparto de días por deporte y objetivo"
```

---

### Task 4: Biblioteca de sesiones + orquestador (`library.ts`, `generate.ts`)

**Files:**
- Create: `lib/planGenerator/library.ts`
- Create: `lib/planGenerator/generate.ts`
- Test: `tests/planGenerator/generate.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/planGenerator/generate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../lib/planGenerator/generate';
import type { OnboardingAnswers, WeekPlan } from '../../types';

const base: OnboardingAnswers = {
  sports: ['run', 'gym'],
  goal: 'race',
  raceDistance: 'half',
  daysPerWeek: 5,
  level: 'intermediate',
};

const volume = (w: WeekPlan) => w.days.reduce((acc, d) => acc + d.duration, 0);

describe('generatePlan', () => {
  it('genera 4 semanas de 7 días con lunes primero y domingo último', () => {
    const weeks = generatePlan(base);
    expect(weeks).toHaveLength(4);
    for (const w of weeks) {
      expect(w.days).toHaveLength(7);
      expect(w.days[0].day).toBe('monday');
      expect(w.days[0].dayName).toBe('Lunes');
      expect(w.days[6].day).toBe('sunday');
    }
  });

  it('los ejercicios llevan id único dentro del día', () => {
    const weeks = generatePlan(base);
    for (const d of weeks[0].days) {
      const ids = (d.exercises ?? []).map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id.startsWith(d.day)).toBe(true));
    }
  });

  it('la semana 4 descarga respecto a la 3', () => {
    const weeks = generatePlan(base);
    expect(volume(weeks[3])).toBeLessThan(volume(weeks[2]));
    expect(weeks[3].focus).toBe('Descarga');
  });

  it('principiante genera menos volumen que avanzado', () => {
    const beginner = generatePlan({ ...base, level: 'beginner' });
    const advanced = generatePlan({ ...base, level: 'advanced' });
    expect(volume(beginner[0])).toBeLessThan(volume(advanced[0]));
  });

  it('los días sin sesión son descanso con duración 0', () => {
    const weeks = generatePlan({ ...base, daysPerWeek: 3 });
    const restDays = weeks[0].days.filter((d) => d.sessionType === 'rest');
    expect(restDays).toHaveLength(4);
    restDays.forEach((d) => expect(d.duration).toBe(0));
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run tests/planGenerator/generate.test.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar `lib/planGenerator/library.ts`**

```ts
import { SESSION_DEFAULTS } from '../../constants/trainingPlan';
import type { DayPlan, ExperienceLevel, SessionType } from '../../types';
import { scaleDayPlan } from './progression';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

const LEVEL_FACTORS: Record<ExperienceLevel, number> = {
  beginner: 0.8,
  intermediate: 1,
  advanced: 1.15,
};

// Reutiliza las plantillas SESSION_DEFAULTS (las mismas del editor de plan)
// como biblioteca de sesiones, escaladas por nivel.
export function dayPlanFor(sessionType: SessionType, dayIndex: number, level: ExperienceLevel): DayPlan {
  const def = SESSION_DEFAULTS[sessionType];
  const day = DAY_KEYS[dayIndex];
  const base: DayPlan = {
    day,
    dayName: DAY_NAMES[dayIndex],
    sessionType,
    title: def.title,
    duration: def.duration,
    description: def.description,
    warmup: def.warmup,
    cooldown: def.cooldown,
    notes: def.notes,
    exercises: def.exercises.map((ex, i) => ({ ...ex, id: `${day}-${i + 1}` })),
  };
  return scaleDayPlan(base, LEVEL_FACTORS[level]);
}
```

- [ ] **Step 4: Implementar `lib/planGenerator/generate.ts`**

```ts
import type { OnboardingAnswers, WeekPlan } from '../../types';
import { dayPlanFor } from './library';
import { buildWeeks } from './progression';
import { scheduleWeek } from './scheduler';

// Único punto de entrada del generador: respuestas → 4 semanas progresivas.
export function generatePlan(answers: OnboardingAnswers): WeekPlan[] {
  const sessionTypes = scheduleWeek(answers);
  const baseDays = sessionTypes.map((type, i) => dayPlanFor(type, i, answers.level));
  return buildWeeks(baseDays);
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx vitest run tests/planGenerator`
Expected: PASS (progression + scheduler + generate).

Nota: si `SESSION_DEFAULTS.rest.duration` no fuese 0 el test de descanso fallaría — es 0 en `constants/trainingPlan.ts:445`, no tocar.

- [ ] **Step 6: Commit**

```bash
git add lib/planGenerator/library.ts lib/planGenerator/generate.ts tests/planGenerator/generate.test.ts
git commit -m "feat: generador de plan de 4 semanas desde la encuesta"
```

---

### Task 5: Normalización de `plan_data` y semana actual (`lib/training/planData.ts`)

**Files:**
- Create: `lib/training/planData.ts`
- Test: `tests/training/planData.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/training/planData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  currentWeekIndex,
  defaultPlanData,
  mondayOfCurrentWeek,
  normalizePlanData,
  planFinished,
} from '../../lib/training/planData';
import type { DayPlan, PlanDataV2 } from '../../types';

const legacyDays: DayPlan[] = [
  { day: 'monday', dayName: 'Lunes', sessionType: 'running_easy', title: 'x', duration: 40, description: 'x' },
];

describe('normalizePlanData', () => {
  it('convierte el formato legacy en 4 semanas idénticas sin perfil', () => {
    const data = normalizePlanData(legacyDays);
    expect(data?.version).toBe(2);
    expect(data?.profile).toBeNull();
    expect(data?.weeks).toHaveLength(4);
    expect(data?.weeks[2].days).toEqual(legacyDays);
  });

  it('deja pasar v2 tal cual', () => {
    const v2: PlanDataV2 = { version: 2, profile: null, weeks: defaultPlanData().weeks };
    expect(normalizePlanData(v2)).toBe(v2);
  });

  it('devuelve null para datos inválidos', () => {
    expect(normalizePlanData(null)).toBeNull();
    expect(normalizePlanData([])).toBeNull();
    expect(normalizePlanData({ version: 1 })).toBeNull();
    expect(normalizePlanData({ version: 2, weeks: [] })).toBeNull();
  });
});

describe('semana actual', () => {
  const now = new Date('2026-07-08T12:00:00');
  it('calcula el índice desde start_date', () => {
    expect(currentWeekIndex('2026-07-06', 4, now)).toBe(0);
    expect(currentWeekIndex('2026-06-29', 4, now)).toBe(1);
  });
  it('acota a la última semana y detecta plan terminado', () => {
    expect(currentWeekIndex('2026-01-05', 4, now)).toBe(3);
    expect(planFinished('2026-01-05', 4, now)).toBe(true);
    expect(planFinished('2026-06-29', 4, now)).toBe(false);
  });
  it('sin start_date cae a la semana 1', () => {
    expect(currentWeekIndex(null, 4, now)).toBe(0);
    expect(planFinished(null, 4, now)).toBe(false);
  });
});

describe('mondayOfCurrentWeek', () => {
  it('devuelve el lunes de la semana en curso', () => {
    expect(mondayOfCurrentWeek(new Date('2026-07-08T12:00:00'))).toBe('2026-07-06');
    expect(mondayOfCurrentWeek(new Date('2026-07-06T12:00:00'))).toBe('2026-07-06');
    expect(mondayOfCurrentWeek(new Date('2026-07-12T12:00:00'))).toBe('2026-07-06');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run tests/training/planData.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `lib/training/planData.ts`**

```ts
import { WEEKLY_STRUCTURE } from '../../constants/trainingPlan';
import type { DayPlan, PlanDataV2, WeekPlan } from '../../types';

function weeksFromDays(days: DayPlan[]): WeekPlan[] {
  return [1, 2, 3, 4].map((week) => ({
    week,
    phase: 'base' as const,
    focus: 'Plan semanal',
    days,
  }));
}

export function defaultPlanData(): PlanDataV2 {
  return { version: 2, profile: null, weeks: weeksFromDays(WEEKLY_STRUCTURE) };
}

// plan_data legacy = array plano de 7 DayPlan; v2 = { version: 2, profile, weeks }.
// El legacy se expande a 4 semanas idénticas solo en memoria: no se reescribe
// en Supabase hasta el siguiente guardado.
export function normalizePlanData(raw: unknown): PlanDataV2 | null {
  if (Array.isArray(raw)) {
    return raw.length ? { version: 2, profile: null, weeks: weeksFromDays(raw as DayPlan[]) } : null;
  }
  if (raw && typeof raw === 'object' && (raw as { version?: unknown }).version === 2) {
    const candidate = raw as PlanDataV2;
    if (Array.isArray(candidate.weeks) && candidate.weeks.length > 0) return candidate;
  }
  return null;
}

const WEEK_MS = 7 * 86_400_000;

function rawWeekIndex(startDateIso: string | null | undefined, now: Date): number {
  if (!startDateIso) return 0;
  const start = new Date(`${startDateIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.floor((now.getTime() - start.getTime()) / WEEK_MS);
}

export function currentWeekIndex(
  startDateIso: string | null | undefined,
  totalWeeks: number,
  now: Date = new Date(),
): number {
  return Math.min(totalWeeks - 1, Math.max(0, rawWeekIndex(startDateIso, now)));
}

export function planFinished(
  startDateIso: string | null | undefined,
  totalWeeks: number,
  now: Date = new Date(),
): boolean {
  return rawWeekIndex(startDateIso, now) >= totalWeeks;
}

// Mismo criterio de fecha (toISOString) que getCurrentWeekDates en useTraining.
export function mondayOfCurrentWeek(now: Date = new Date()): string {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return monday.toISOString().split('T')[0];
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run tests/training/planData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/training/planData.ts tests/training/planData.test.ts
git commit -m "feat: normalización de plan_data v2 y cálculo de semana actual"
```

---

### Task 6: `PlanContext` v2

**Files:**
- Modify: `lib/PlanContext.tsx` (reescritura completa)

`PlanContext` pasa de `DayPlan[]` a semanas. API nueva: `weeks`, `weekIndex` (semana seleccionada, arranca en la actual), `currentWeekIndex`, `planFinished`, `setWeekIndex`, `days` (días de la semana seleccionada — mantiene compatibilidad con Hoy/editor/coach), `hasPlan`, `save` (escribe la semana seleccionada), `replacePlan` (onboarding). Sin tests unitarios (usa Supabase/React); se valida con `tsc` y el flujo E2E final.

- [ ] **Step 1: Reemplazar `lib/PlanContext.tsx` entero con:**

```tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { DayPlan, PlanDataV2, WeekPlan } from '../types';
import {
  currentWeekIndex as computeWeekIndex,
  defaultPlanData,
  mondayOfCurrentWeek,
  normalizePlanData,
  planFinished as computePlanFinished,
} from './training/planData';

interface PlanContextValue {
  weeks: WeekPlan[];
  days: DayPlan[];
  weekIndex: number;
  currentWeekIndex: number;
  planFinished: boolean;
  setWeekIndex: (i: number) => void;
  loading: boolean;
  hasPlan: boolean;
  save: (next: DayPlan[]) => Promise<string | null>;
  replacePlan: (data: PlanDataV2) => Promise<string | null>;
}

const PlanContext = createContext<PlanContextValue>({
  weeks: defaultPlanData().weeks,
  days: defaultPlanData().weeks[0].days,
  weekIndex: 0,
  currentWeekIndex: 0,
  planFinished: false,
  setWeekIndex: () => {},
  loading: true,
  hasPlan: false,
  save: async () => null,
  replacePlan: async () => null,
});

// El plan vive en training_plans.plan_data (una fila por usuario). El formato
// legacy (DayPlan[]) se normaliza en memoria; se reescribe como v2 al guardar.
export function PlanProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [planData, setPlanData] = useState<PlanDataV2>(defaultPlanData());
  const [planId, setPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weekIndex, setWeekIndexState] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const userId = session?.user?.id;
      if (!userId) {
        if (active) {
          setPlanData(defaultPlanData());
          setPlanId(null);
          setStartDate(null);
          setHasPlan(false);
          setWeekIndexState(0);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from('training_plans')
        .select('id, plan_data, start_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      const normalized = normalizePlanData(data?.plan_data);
      if (normalized) {
        setPlanData(normalized);
        setStartDate((data?.start_date as string) ?? null);
        setHasPlan(true);
        setWeekIndexState(computeWeekIndex(data?.start_date as string, normalized.weeks.length));
      } else {
        setPlanData(defaultPlanData());
        setStartDate(null);
        setHasPlan(false);
        setWeekIndexState(0);
      }
      setPlanId(data?.id ?? null);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [session?.user?.id]);

  const persist = useCallback(async (nextData: PlanDataV2, nextStartDate?: string): Promise<string | null> => {
    const userId = session?.user?.id;
    if (!userId) return 'No hay sesión activa';

    if (planId) {
      const patch: { plan_data: PlanDataV2; start_date?: string; phase?: string } = { plan_data: nextData };
      if (nextStartDate) { patch.start_date = nextStartDate; patch.phase = 'base'; }
      const { error } = await supabase.from('training_plans').update(patch).eq('id', planId);
      if (error) return error.message;
    } else {
      const start = nextStartDate ?? mondayOfCurrentWeek();
      const { data, error } = await supabase
        .from('training_plans')
        .insert({
          user_id: userId,
          name: 'Mi plan',
          phase: 'base',
          start_date: start,
          goal_race_date: start,
          plan_data: nextData,
        })
        .select('id')
        .single();
      if (error) return error.message;
      setPlanId(data.id);
    }
    setPlanData(nextData);
    setHasPlan(true);
    if (nextStartDate) setStartDate(nextStartDate);
    return null;
  }, [session?.user?.id, planId]);

  const save = useCallback(async (next: DayPlan[]): Promise<string | null> => {
    const nextData: PlanDataV2 = {
      ...planData,
      weeks: planData.weeks.map((w, i) => (i === weekIndex ? { ...w, days: next } : w)),
    };
    return persist(nextData);
  }, [planData, weekIndex, persist]);

  const replacePlan = useCallback(async (data: PlanDataV2): Promise<string | null> => {
    const start = mondayOfCurrentWeek();
    const err = await persist(data, start);
    if (!err) setWeekIndexState(0);
    return err;
  }, [persist]);

  const setWeekIndex = useCallback((i: number) => {
    setWeekIndexState((prev) => {
      const max = planData.weeks.length - 1;
      const next = Math.min(max, Math.max(0, i));
      return next === prev ? prev : next;
    });
  }, [planData.weeks.length]);

  const currentIdx = computeWeekIndex(startDate, planData.weeks.length);
  const days = planData.weeks[weekIndex]?.days ?? planData.weeks[0].days;

  return (
    <PlanContext.Provider
      value={{
        weeks: planData.weeks,
        days,
        weekIndex,
        currentWeekIndex: currentIdx,
        planFinished: hasPlan && computePlanFinished(startDate, planData.weeks.length),
        setWeekIndex,
        loading,
        hasPlan,
        save,
        replacePlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
```

- [ ] **Step 2: Verificar compilación y tests existentes**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` sin errores (los consumidores solo usan `days`, `save`, `loading`, que se mantienen); vitest en verde.

- [ ] **Step 3: Commit**

```bash
git add lib/PlanContext.tsx
git commit -m "feat: PlanContext con semanas v2, semana seleccionada y replacePlan"
```

---

### Task 7: Guard de onboarding en el root layout

**Files:**
- Modify: `app/_layout.tsx:47-56` (función `NavigationGuard`) y el `<Stack>` (~línea 72)

- [ ] **Step 1: Ampliar `NavigationGuard`**

Reemplazar la función `NavigationGuard` actual:

```tsx
function NavigationGuard() {
  const { session, initialized } = useAuth();

  useEffect(() => {
    if (!initialized) return;
    router.replace(session ? '/(tabs)/hoy' : '/(auth)/login');
  }, [session, initialized]);

  return null;
}
```

por:

```tsx
function NavigationGuard() {
  const { session, initialized } = useAuth();
  const { loading, hasPlan } = usePlan();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      router.replace('/(auth)/login');
      return;
    }
    if (loading) return;
    router.replace(hasPlan ? '/(tabs)/hoy' : '/onboarding');
  }, [session, initialized, loading, hasPlan]);

  return null;
}
```

Y en los imports del archivo, cambiar:

```tsx
import { PlanProvider } from '../lib/PlanContext';
```

por:

```tsx
import { PlanProvider, usePlan } from '../lib/PlanContext';
```

(`NavigationGuard` ya se renderiza dentro de `PlanProvider`, así que `usePlan` funciona.)

- [ ] **Step 2: Registrar la pantalla en el Stack**

Dentro del `<Stack>`, después de `<Stack.Screen name="(tabs)" />`, añadir:

```tsx
              <Stack.Screen name="onboarding" />
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores (la ruta `/onboarding` aún no existe como archivo, pero `router.replace` recibe string y expo-router no lo comprueba en tiempo de compilación; la pantalla se crea en la Task 8, en el mismo push de funcionalidad).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: guard que lleva a onboarding a usuarios sin plan"
```

---

### Task 8: Wizard `app/onboarding.tsx`

**Files:**
- Create: `app/onboarding.tsx`

Cinco pasos: deportes (multi) → objetivo → evento (solo si objetivo carrera) → días+nivel → resumen. Al generar: `replacePlan` con el plan generado; si hay carrera con fecha, crea el evento (`addEvent` + `setGoalRace`) y si eso falla solo avisa (el plan ya está guardado). «Usar plan por defecto» guarda `defaultPlanData()`.

- [ ] **Step 1: Crear `app/onboarding.tsx` completo**

```tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { usePlan } from '../lib/PlanContext';
import { useEvents } from '../hooks/useEvents';
import { generatePlan } from '../lib/planGenerator/generate';
import { defaultPlanData } from '../lib/training/planData';
import {
  ExperienceLevel,
  OnboardingAnswers,
  OnboardingGoal,
  PlanDataV2,
  RaceDistanceChoice,
  SportChoice,
} from '../types';

const SPORTS: Array<{ key: SportChoice; label: string; desc: string }> = [
  { key: 'run', label: 'Running', desc: 'Rodajes, series y tiradas largas' },
  { key: 'swim', label: 'Natación', desc: 'Técnica y resistencia en piscina' },
  { key: 'gym', label: 'Gimnasio', desc: 'Fuerza funcional y movilidad' },
  { key: 'hyrox', label: 'Hyrox', desc: 'Circuitos funcionales y simulaciones' },
];

const GOALS: Array<{ key: OnboardingGoal; label: string; desc: string }> = [
  { key: 'race', label: 'Preparar una carrera', desc: '5K, 10K, media, maratón o Hyrox' },
  { key: 'general_fitness', label: 'Mejorar mi forma', desc: 'Salud y condición física general' },
  { key: 'lose_weight', label: 'Perder peso', desc: 'Más volumen aeróbico en tu semana' },
  { key: 'gain_strength', label: 'Ganar fuerza', desc: 'Más gimnasio y progresión de cargas' },
];

const DISTANCES: Array<{ key: RaceDistanceChoice; label: string }> = [
  { key: '5k', label: '5K' },
  { key: '10k', label: '10K' },
  { key: 'half', label: 'Media maratón' },
  { key: 'marathon', label: 'Maratón' },
  { key: 'hyrox', label: 'Hyrox' },
];

const LEVELS: Array<{ key: ExperienceLevel; label: string; desc: string }> = [
  { key: 'beginner', label: 'Principiante', desc: 'Menos de un año entrenando con regularidad' },
  { key: 'intermediate', label: 'Intermedio', desc: 'Entrenas con constancia desde hace tiempo' },
  { key: 'advanced', label: 'Avanzado', desc: 'Compites o entrenas con estructura' },
];

const RACE_KM: Record<RaceDistanceChoice, number> = {
  '5k': 5, '10k': 10, half: 21.1, marathon: 42.2, hyrox: 8,
};
const RACE_TITLES: Record<RaceDistanceChoice, string> = {
  '5k': 'Carrera 5K', '10k': 'Carrera 10K', half: 'Media maratón', marathon: 'Maratón', hyrox: 'Hyrox',
};

// Alert.alert no bloquea en react-native-web; mismo patrón que plan/[day].tsx.
function notifyWarning(msg: string) {
  if (Platform.OS === 'web') { window.alert(msg); return; }
  Alert.alert('Aviso', msg);
}

type Step = 'sports' | 'goal' | 'race' | 'availability' | 'summary';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { hasPlan, replacePlan } = usePlan();
  const { addEvent, setGoalRace } = useEvents();

  const [step, setStep] = useState<Step>('sports');
  const [sports, setSports] = useState<SportChoice[]>([]);
  const [goal, setGoal] = useState<OnboardingGoal | null>(null);
  const [raceDistance, setRaceDistance] = useState<RaceDistanceChoice | null>(null);
  const [raceDate, setRaceDate] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: Step[] = useMemo(
    () => (goal === 'race'
      ? ['sports', 'goal', 'race', 'availability', 'summary']
      : ['sports', 'goal', 'availability', 'summary']),
    [goal],
  );
  const stepIndex = steps.indexOf(step);

  const canContinue = (() => {
    if (step === 'sports') return sports.length > 0;
    if (step === 'goal') return goal !== null;
    if (step === 'race') {
      if (!raceDistance) return false;
      return raceDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(raceDate);
    }
    if (step === 'availability') return daysPerWeek !== null && level !== null;
    return true;
  })();

  const goNext = () => { setError(null); setStep(steps[stepIndex + 1]); };
  const goBack = () => {
    setError(null);
    if (stepIndex === 0) { if (hasPlan) router.back(); return; }
    setStep(steps[stepIndex - 1]);
  };

  const toggleSport = (key: SportChoice) => {
    setSports((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  async function finish(useDefault: boolean) {
    if (!goal || !daysPerWeek || !level) return;
    setSaving(true);
    setError(null);

    const answers: OnboardingAnswers = {
      sports,
      goal,
      raceDistance: goal === 'race' && raceDistance ? raceDistance : undefined,
      raceDate: goal === 'race' && raceDate ? raceDate : undefined,
      daysPerWeek,
      level,
    };
    const data: PlanDataV2 = useDefault
      ? defaultPlanData()
      : { version: 2, profile: answers, weeks: generatePlan(answers) };

    const err = await replacePlan(data);
    if (err) { setError(err); setSaving(false); return; }

    // El plan ya está guardado: un fallo creando el evento solo genera aviso.
    if (!useDefault && goal === 'race' && raceDistance && raceDate) {
      const { id, error: evErr } = await addEvent({
        title: RACE_TITLES[raceDistance],
        date: raceDate,
        kind: 'race',
        race: { distance_km: RACE_KM[raceDistance], is_goal: true },
      });
      const goalErr = id ? await setGoalRace(id) : (evErr ?? 'No se pudo crear la carrera');
      if (goalErr) notifyWarning(`El plan se ha creado, pero la carrera no se pudo añadir a la agenda: ${goalErr}. Puedes crearla a mano.`);
    }

    setSaving(false);
    router.replace('/(tabs)/hoy');
  }

  const summarySports = sports.map((k) => SPORTS.find((s) => s.key === k)?.label).join(', ');

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={s.progressRow}>
        {steps.map((st, i) => (
          <View
            key={st}
            style={[s.progressSeg, { backgroundColor: i <= stepIndex ? colors.accent : colors.border }]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 'sports' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>¿Qué practicas?</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              Elige los deportes que practicas o quieres practicar. Puedes marcar varios.
            </Text>
            {SPORTS.map((sp) => (
              <OptionCard
                key={sp.key}
                label={sp.label}
                desc={sp.desc}
                selected={sports.includes(sp.key)}
                onPress={() => toggleSport(sp.key)}
              />
            ))}
          </>
        )}

        {step === 'goal' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>¿Cuál es tu objetivo?</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              El reparto de tu semana se adapta a lo que busques.
            </Text>
            {GOALS.map((g) => (
              <OptionCard
                key={g.key}
                label={g.label}
                desc={g.desc}
                selected={goal === g.key}
                onPress={() => setGoal(g.key)}
              />
            ))}
          </>
        )}

        {step === 'race' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>Tu carrera</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              Distancia y, si ya la sabes, la fecha: la añadimos a tu agenda como carrera objetivo.
            </Text>
            <View style={s.chipsRow}>
              {DISTANCES.map((d) => (
                <Chip
                  key={d.key}
                  label={d.label}
                  selected={raceDistance === d.key}
                  onPress={() => setRaceDistance(d.key)}
                />
              ))}
            </View>
            <Input
              label="Fecha (AAAA-MM-DD, opcional)"
              value={raceDate}
              onChangeText={setRaceDate}
              placeholder="2026-10-25"
              autoCapitalize="none"
            />
          </>
        )}

        {step === 'availability' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>Tu disponibilidad</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>¿Cuántos días puedes entrenar a la semana?</Text>
            <View style={s.chipsRow}>
              {[3, 4, 5, 6, 7].map((n) => (
                <Chip key={n} label={`${n}`} selected={daysPerWeek === n} onPress={() => setDaysPerWeek(n)} />
              ))}
            </View>
            <Text style={[s.sectionLabel, { color: colors.text3 }]}>TU NIVEL</Text>
            {LEVELS.map((l) => (
              <OptionCard
                key={l.key}
                label={l.label}
                desc={l.desc}
                selected={level === l.key}
                onPress={() => setLevel(l.key)}
              />
            ))}
          </>
        )}

        {step === 'summary' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>Tu plan de 4 semanas</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              3 semanas de carga progresiva y una de descarga, repartidas según tus respuestas.
            </Text>
            <SummaryRow label="Deportes" value={summarySports} />
            <SummaryRow label="Objetivo" value={GOALS.find((g) => g.key === goal)?.label ?? ''} />
            {goal === 'race' && raceDistance && (
              <SummaryRow
                label="Carrera"
                value={`${RACE_TITLES[raceDistance]}${raceDate ? ` · ${raceDate}` : ''}`}
              />
            )}
            <SummaryRow label="Días por semana" value={String(daysPerWeek ?? '')} />
            <SummaryRow label="Nivel" value={LEVELS.find((l) => l.key === level)?.label ?? ''} />

            {hasPlan && (
              <Text style={[s.warning, { color: colors.text3 }]}>
                ⚠️ Generar un plan nuevo sustituirá tu plan actual. Tus sesiones registradas no se tocan.
              </Text>
            )}
            {error && <Text style={s.error}>{error}</Text>}
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step === 'summary' ? (
          <>
            <Button label="Generar mi plan" onPress={() => finish(false)} loading={saving} fullWidth />
            <Button
              label="Usar plan por defecto"
              variant="ghost"
              onPress={() => finish(true)}
              disabled={saving}
              fullWidth
            />
          </>
        ) : (
          <Button label="Continuar" onPress={goNext} disabled={!canContinue} fullWidth />
        )}
        {(stepIndex > 0 || hasPlan) && (
          <Button label="Atrás" variant="ghost" onPress={goBack} disabled={saving} fullWidth />
        )}
      </View>
    </SafeAreaView>
  );
}

function OptionCard({ label, desc, selected, onPress }: {
  label: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        s.option,
        {
          backgroundColor: colors.glassBg,
          borderColor: selected ? colors.accent : colors.glassBorder,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={s.optionMain}>
        <Text style={[s.optionLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[s.optionDesc, { color: colors.text3 }]}>{desc}</Text>
      </View>
      <View style={[s.radio, { borderColor: selected ? colors.accent : colors.border }]}>
        {selected && <View style={[s.radioInner, { backgroundColor: colors.accent }]} />}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        s.chip,
        {
          backgroundColor: selected ? colors.accent : colors.glassBg,
          borderColor: selected ? colors.accent : colors.glassBorder,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.chipText, { color: selected ? '#fff' : colors.text2 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.summaryRow, { borderBottomColor: colors.glassBorder }]}>
      <Text style={[s.summaryLabel, { color: colors.text3 }]}>{label}</Text>
      <Text style={[s.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  progressRow: {
    flexDirection: 'row',
    gap: Spacing.gapSm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.base,
  },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.gapMd },
  title: { fontSize: FontSize.xxxl, fontWeight: FontWeight.black, letterSpacing: -0.5, marginTop: Spacing.base },
  subtitle: { fontSize: FontSize.md, lineHeight: 20, marginBottom: Spacing.gapSm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.65,
    marginTop: Spacing.base,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.base,
  },
  optionMain: { flex: 1, gap: 2 },
  optionLabel: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  optionDesc: { fontSize: FontSize.md, lineHeight: 18 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.gapMd,
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapSm,
  },
  chipText: { fontSize: FontSize.md, fontWeight: FontWeight.label },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.gapMd,
    borderBottomWidth: 1,
    gap: Spacing.gapMd,
  },
  summaryLabel: { fontSize: FontSize.md },
  summaryValue: { fontSize: FontSize.md, fontWeight: FontWeight.label, flexShrink: 1, textAlign: 'right' },
  warning: { fontSize: FontSize.md, lineHeight: 18, marginTop: Spacing.gapSm },
  error: { color: '#ff453a', fontSize: FontSize.sm, marginTop: Spacing.gapSm },
  footer: { padding: Spacing.lg, gap: Spacing.gapSm },
});
```

- [ ] **Step 2: Verificar compilación y tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores, tests en verde. Si `colors.text2` no existiese, usar `colors.text` (comprobar en `constants/colors.ts`; `Button.tsx` ya usa `colors.text2`, así que existe).

- [ ] **Step 3: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat: wizard de onboarding con generación del plan de 4 semanas"
```

---

### Task 9: Selector de semanas y banner en Semana

**Files:**
- Modify: `app/(tabs)/semana.tsx`

- [ ] **Step 1: Actualizar imports y hooks**

En `app/(tabs)/semana.tsx`, cambiar:

```tsx
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
```

por:

```tsx
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
```

Cambiar:

```tsx
import { getCurrentWeek, getPhaseLabel, useWeekSessions } from '../../hooks/useTraining';
```

por:

```tsx
import { useWeekSessions } from '../../hooks/useTraining';
```

Y dentro de `SemanaScreen`, cambiar:

```tsx
  const todayKey = DAY_MAP[new Date().getDay()];
  const week = getCurrentWeek();
  const { days } = usePlan();
```

por:

```tsx
  const todayKey = DAY_MAP[new Date().getDay()];
  const { days, weeks, weekIndex, currentWeekIndex, setWeekIndex, planFinished } = usePlan();
```

- [ ] **Step 2: Sustituir el badge del header y añadir selector + banner**

Cambiar el bloque del header:

```tsx
        <View style={s.weekHeader}>
          <Text style={[s.weekTitle, { color: colors.text }]}>Esta semana</Text>
          <View style={[s.weekBadge, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderWidth: 1 }]}>
            <Text style={[s.weekBadgeText, { color: colors.text3 }]}>Semana {week} · Fase {getPhaseLabel(week)}</Text>
          </View>
        </View>
```

por:

```tsx
        <View style={s.weekHeader}>
          <Text style={[s.weekTitle, { color: colors.text }]}>Tu plan</Text>
          <View style={[s.weekBadge, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderWidth: 1 }]}>
            <Text style={[s.weekBadgeText, { color: colors.text3 }]}>
              Semana {weekIndex + 1} · {weeks[weekIndex]?.focus ?? 'Base'}
            </Text>
          </View>
        </View>

        <View style={s.weekSelector}>
          {weeks.map((w, i) => {
            const active = i === weekIndex;
            return (
              <TouchableOpacity
                key={w.week}
                style={[
                  s.weekTab,
                  {
                    backgroundColor: active ? colors.accent : colors.glassBg,
                    borderColor: active ? colors.accent : colors.glassBorder,
                  },
                ]}
                onPress={() => setWeekIndex(i)}
                activeOpacity={0.8}
              >
                <Text style={[s.weekTabText, { color: active ? '#fff' : colors.text3 }]}>
                  S{w.week}{i === currentWeekIndex ? ' ·' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {planFinished && (
          <View style={[s.finishedCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <Text style={[s.finishedText, { color: colors.text }]}>
              Plan completado 🎉 Rehaz la encuesta para generar el siguiente bloque de 4 semanas.
            </Text>
            <Button
              label="Rehacer encuesta"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/onboarding')}
            />
          </View>
        )}
```

- [ ] **Step 3: Añadir estilos nuevos**

En el `StyleSheet.create` de `semana.tsx`, tras la línea de `progressDot`, añadir:

```tsx
  weekSelector: { flexDirection: 'row', gap: Spacing.gapSm, marginBottom: Spacing.lg },
  weekTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.gapSm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  weekTabText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  finishedCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.lg,
    gap: Spacing.gapMd,
  },
  finishedText: { fontSize: FontSize.md, lineHeight: 20 },
```

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores. Comprobar que ya no queda ninguna referencia a `getCurrentWeek`/`getPhaseLabel` en el archivo (`grep -n "getCurrentWeek\|getPhaseLabel" "app/(tabs)/semana.tsx"` no devuelve nada).

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/semana.tsx"
git commit -m "feat: selector de semanas 1-4 y aviso de plan completado en Semana"
```

---

### Task 10: Hoy usa la semana actual + botón Rehacer encuesta en Plan

**Files:**
- Modify: `app/(tabs)/hoy.tsx:43-44` y `:242-246`
- Modify: `app/plan/index.tsx`

- [ ] **Step 1: Hoy fija la semana actual (no la seleccionada)**

En `app/(tabs)/hoy.tsx`, cambiar:

```tsx
  const { days, save } = usePlan();
  const { plan: todayPlan, weekNumber, dayKey, refresh } = useToday();
```

por:

```tsx
  const { weeks, currentWeekIndex, save } = usePlan();
  const days = weeks[currentWeekIndex]?.days ?? [];
  const { plan: todayPlan, weekNumber, dayKey, refresh } = useToday();
```

(Nota: `save` escribe en la semana *seleccionada* de PlanContext; las propuestas `adjust_plan` del coach desde Hoy son un caso raro y la semana seleccionada arranca en la actual, así que se acepta. No complicar.)

Y el chip del header, cambiar:

```tsx
                  <Text style={[s.weekChipText, { color: colors.text3 }]}>
                    Semana {weekNumber} · {getPhaseLabel(weekNumber)}
                  </Text>
```

por:

```tsx
                  <Text style={[s.weekChipText, { color: colors.text3 }]}>
                    Semana {currentWeekIndex + 1} · {weeks[currentWeekIndex]?.focus ?? 'Base'}
                  </Text>
```

`weekNumber` y `getPhaseLabel` siguen usándose en `buildGreeting` (línea ~213) — no tocar esos usos ni sus imports.

- [ ] **Step 2: Botón en la pantalla Plan**

En `app/plan/index.tsx`, añadir el import:

```tsx
import { Button } from '../../components/ui/Button';
```

y tras el cierre del `.map` de días (después de `})}` y antes de `</ScrollView>`), añadir:

```tsx
        <Button
          label="Rehacer encuesta y regenerar plan"
          variant="ghost"
          fullWidth
          onPress={() => router.push('/onboarding')}
        />
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/hoy.tsx" app/plan/index.tsx
git commit -m "feat: Hoy ancla la semana actual y Plan permite rehacer la encuesta"
```

---

### Task 11: Verificación final

- [ ] **Step 1: Suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: cero errores de tipos; todos los tests (agenda, coach, training, planGenerator) en verde.

- [ ] **Step 2: Verificación E2E con la app**

Usar el skill `verify` (o `run`) para arrancar la app (`npx expo start --web` es lo más rápido) y comprobar:

1. **Usuario nuevo:** registrarse → tras login redirige a `/onboarding` → completar la encuesta (p. ej. running+gym, carrera media maratón con fecha, 5 días, intermedio) → «Generar mi plan» → aterriza en Hoy; la pestaña Semana muestra la semana 1 con los deportes elegidos, sábado tirada larga; la Agenda muestra la carrera objetivo con la fecha dada.
2. **Usuario existente (plan legacy):** login → NO redirige a onboarding; Semana muestra el plan de siempre con selector S1-S4 (semanas idénticas); editar un día y guardar sigue funcionando.
3. **Relanzar:** Semana → Editar plan → «Rehacer encuesta y regenerar plan» → completar → el plan cambia.
4. **Error de guardado:** (opcional) sin red, «Generar mi plan» muestra el error y permite reintentar.

- [ ] **Step 3: Commit final si hubo ajustes**

```bash
git add -A && git commit -m "fix: ajustes de verificación E2E del onboarding"
```

---

## Notas para el ejecutor

- **No hay migración SQL:** `plan_data` es jsonb y admite el objeto v2 tal cual. No tocar `supabase/schema.sql`.
- **RLS:** todas las escrituras van del cliente a Supabase con el JWT del usuario (regla de oro del proyecto: nada de `service_role`).
- **`SESSION_DEFAULTS` es la biblioteca:** si un test del generador falla por contenido de sesión, el problema suele estar en asumir campos que la plantilla no tiene (p. ej. `rest` no tiene `warmup`). Los campos opcionales de `DayPlan` aceptan `undefined`.
- **El editor y el coach no cambian:** consumen `days`/`save` del contexto, que ahora apuntan a la semana seleccionada. `executeProposal` (coach) recibe `savePlan: save` y sigue funcionando.
- **Orden de tasks:** 1→5 son módulos puros con tests; 6→10 son UI verificada con `tsc`; 11 cierra con E2E. No adelantar tasks de UI sin los módulos puros en verde.

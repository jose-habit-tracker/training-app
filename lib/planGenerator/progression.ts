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

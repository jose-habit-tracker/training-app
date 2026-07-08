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

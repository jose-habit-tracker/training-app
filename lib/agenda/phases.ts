import type { TrainingPhase } from '../../types';

export interface PhaseRange {
  phase: TrainingPhase;
  start: string; // ISO, lunes de inicio
  end: string;   // ISO, domingo final (inclusive)
}

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().split('T')[0];
const at = (s: string) => new Date(`${s}T00:00:00Z`);

function mondayOfWeek(d: Date): Date {
  const shift = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - shift * DAY_MS);
}

// Duración estándar hacia atrás desde la semana de carrera: taper 2, peak 4, build 4.
// Base ocupa lo que quede hasta start_date; si no queda hueco, la fase se omite.
const BACKWARD: Array<{ phase: TrainingPhase; weeks: number }> = [
  { phase: 'race', weeks: 1 },
  { phase: 'taper', weeks: 2 },
  { phase: 'peak', weeks: 4 },
  { phase: 'build', weeks: 4 },
];

export function computePhases(startDate: string, raceDate: string): PhaseRange[] {
  const start = at(startDate);
  const raceMonday = mondayOfWeek(at(raceDate));
  const ranges: PhaseRange[] = [];
  let cursor = new Date(raceMonday.getTime() + 7 * DAY_MS); // exclusivo

  for (const { phase, weeks } of BACKWARD) {
    const phaseStart = new Date(cursor.getTime() - weeks * 7 * DAY_MS);
    const clampedStart = phaseStart < start ? start : phaseStart;
    if (clampedStart < cursor) {
      ranges.unshift({ phase, start: iso(clampedStart), end: iso(new Date(cursor.getTime() - DAY_MS)) });
    }
    cursor = phaseStart;
    if (cursor <= start) break;
  }

  if (start < cursor) {
    ranges.unshift({ phase: 'base', start: iso(start), end: iso(new Date(cursor.getTime() - DAY_MS)) });
  }
  return ranges;
}

export function phaseAt(phases: PhaseRange[], date: string): TrainingPhase | null {
  const hit = phases.find((p) => date >= p.start && date <= p.end);
  return hit?.phase ?? null;
}

export function compliancePct(completed: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.min(100, Math.round((completed / planned) * 100));
}

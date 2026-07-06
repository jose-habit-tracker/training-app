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

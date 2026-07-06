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
interface OptionalSessionFields {
  session_type?: SessionType;
  subtype?: SessionSubtype;
  duration_min?: number;
  rpe?: number;
  fatigue?: number;
  notes?: string;
  metrics?: SessionMetrics;
}

function optionalSessionFields(o: Record<string, unknown>): OptionalSessionFields {
  const out: OptionalSessionFields = {};
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

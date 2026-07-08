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

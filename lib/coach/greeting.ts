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

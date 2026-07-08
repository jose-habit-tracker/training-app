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

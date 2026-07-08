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

import { describe, it, expect } from 'vitest';
import { applyProposedDays } from '../../lib/coach/planMerge';
import type { DayPlan } from '../../types';

const base: DayPlan[] = [
  {
    day: 'monday', dayName: 'Lunes', sessionType: 'running_threshold',
    title: 'Running Umbral', duration: 60, description: 'Umbral 3x10',
    exercises: [{ id: 'm1', name: 'Umbral 10min', sets: 3, reps: '10 min' }],
  },
  {
    day: 'tuesday', dayName: 'Martes', sessionType: 'swimming',
    title: 'Natación Técnica', duration: 45, description: 'Técnica',
  },
];

describe('applyProposedDays', () => {
  it('funde solo los días propuestos y conserva el resto', () => {
    const out = applyProposedDays(base, [{ day: 'tuesday', title: 'Natación Series', duration: 50 } as DayPlan]);
    expect(out[0]).toEqual(base[0]);
    expect(out[1].title).toBe('Natación Series');
    expect(out[1].duration).toBe(50);
    expect(out[1].sessionType).toBe('swimming'); // no propuesto → se conserva
  });

  it('descarta sessionType inválido y duración no positiva', () => {
    const out = applyProposedDays(base, [
      { day: 'monday', sessionType: 'yoga', duration: -5 } as unknown as DayPlan,
    ]);
    expect(out[0].sessionType).toBe('running_threshold');
    expect(out[0].duration).toBe(60);
  });

  it('sanea ejercicios: sin nombre → fuera', () => {
    const out = applyProposedDays(base, [
      { day: 'monday', exercises: [{ name: 'Cuestas' }, { sets: 3 }] } as unknown as DayPlan,
    ]);
    expect(out[0].exercises?.length).toBe(1);
    expect(out[0].exercises?.[0].name).toBe('Cuestas');
  });
});

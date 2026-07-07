import { describe, it, expect } from 'vitest';
import { exerciseSummary, sessionTotals } from '../../lib/training/summary';
import type { ExerciseTemplate } from '../../types';

const ex = (partial: Partial<ExerciseTemplate>): ExerciseTemplate => ({ id: 'x', name: 'Test', ...partial });

describe('exerciseSummary', () => {
  it('natación: series×distancia con descanso', () => {
    expect(exerciseSummary(ex({ sets: 8, distance: '100m', rest: '30s' }))).toBe('8×100m · desc 30s');
  });
  it('gym: series×reps con carga', () => {
    expect(exerciseSummary(ex({ sets: 4, reps: '8 por lado', load: '20 kg' }))).toBe('4×8 por lado · 20 kg');
  });
  it('solo duración', () => {
    expect(exerciseSummary(ex({ duration: '15 min' }))).toBe('15 min');
  });
  it('sin datos devuelve cadena vacía', () => {
    expect(exerciseSummary(ex({}))).toBe('');
  });
});

describe('sessionTotals', () => {
  it('suma metros en natación (sets × distancia en m)', () => {
    const list = [ex({ distance: '200m' }), ex({ sets: 8, distance: '100m' }), ex({ sets: 6, distance: '50m' })];
    expect(sessionTotals(list, 'swim')).toBe('1.300 m totales');
  });
  it('gym cuenta ejercicios', () => {
    expect(sessionTotals([ex({}), ex({})], 'gym')).toBe('2 ejercicios');
  });
  it('lista vacía devuelve cadena vacía', () => {
    expect(sessionTotals([], 'swim')).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeLegacyExercises } from '../../lib/training/normalize';
import type { ExerciseTemplate } from '../../types';

const ex = (partial: Partial<ExerciseTemplate>): ExerciseTemplate => ({ id: 'x', name: 'Test', ...partial });

describe('normalizeLegacyExercises', () => {
  it('convierte reps "6x50m" heredado a sets + distance', () => {
    const [out] = normalizeLegacyExercises([ex({ reps: '6x50m', rest: '20s' })]);
    expect(out.sets).toBe(6);
    expect(out.distance).toBe('50m');
    expect(out.reps).toBeUndefined();
    expect(out.rest).toBe('20s');
  });

  it('respeta ejercicios que ya usan sets + distance', () => {
    const [out] = normalizeLegacyExercises([ex({ sets: 4, distance: '100m' })]);
    expect(out).toEqual(ex({ sets: 4, distance: '100m' }));
  });

  it('no toca reps que no siguen el patrón NxDm', () => {
    const [out] = normalizeLegacyExercises([ex({ reps: '10 brazadas' })]);
    expect(out.reps).toBe('10 brazadas');
    expect(out.sets).toBeUndefined();
  });

  it('tolera separador × y espacios', () => {
    const [out] = normalizeLegacyExercises([ex({ reps: '8 × 100 m' })]);
    expect(out.sets).toBe(8);
    expect(out.distance).toBe('100m');
  });

  it('convierte reps "4x8 min" heredado a sets + duration', () => {
    const [out] = normalizeLegacyExercises([ex({ reps: '4x8 min', rest: '2 min entre series' })]);
    expect(out.sets).toBe(4);
    expect(out.duration).toBe('8 min');
    expect(out.reps).toBeUndefined();
    expect(out.rest).toBe('2 min entre series');
  });

  it('tolera separador × en el patrón de minutos', () => {
    const [out] = normalizeLegacyExercises([ex({ reps: '6 × 3 min' })]);
    expect(out.sets).toBe(6);
    expect(out.duration).toBe('3 min');
  });

  it('no toca reps de estilo gym como "8 por lado"', () => {
    const [out] = normalizeLegacyExercises([ex({ sets: 4, reps: '8 por lado' })]);
    expect(out.reps).toBe('8 por lado');
    expect(out.sets).toBe(4);
  });

  it('no toca reps numéricas planas como "12"', () => {
    const [out] = normalizeLegacyExercises([ex({ sets: 3, reps: '12' })]);
    expect(out.reps).toBe('12');
  });
});

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
  it('run convierte a km con coma decimal a partir de 1000 m', () => {
    expect(sessionTotals([ex({ sets: 6, distance: '400m' })], 'run')).toBe('2,4 km totales');
  });
  it('convierte distancias en km a metros', () => {
    expect(sessionTotals([ex({ distance: '1.5km' })], 'swim')).toBe('1.500 m totales');
  });
  it('distancia no parseable cae al conteo de bloques', () => {
    expect(sessionTotals([ex({ distance: 'por sensaciones' })], 'swim')).toBe('1 bloques');
  });
  it('run por debajo de 1000 m se queda en metros', () => {
    expect(sessionTotals([ex({ distance: '999m' })], 'run')).toBe('999 m totales');
  });
});

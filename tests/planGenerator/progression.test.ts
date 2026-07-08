import { describe, expect, it } from 'vitest';
import {
  buildWeeks,
  scaleDayPlan,
  scaleDistance,
  scaleDuration,
  scaleExercise,
} from '../../lib/planGenerator/progression';
import type { DayPlan } from '../../types';

const day: DayPlan = {
  day: 'monday',
  dayName: 'Lunes',
  sessionType: 'running_threshold',
  title: 'Umbral',
  duration: 60,
  description: 'test',
  exercises: [
    { id: 'a', name: 'Series', sets: 4, duration: '8 min', rest: '2 min' },
    { id: 'b', name: 'Rodaje', duration: '75-90 min' },
    { id: 'c', name: 'Técnica', distance: '100m' },
    { id: 'd', name: 'Fuerza', sets: 3, reps: '8 por lado', load: '60-80% 1RM' },
  ],
};

describe('scaleDuration', () => {
  it('escala minutos con redondeo a entero por debajo de 20', () => {
    expect(scaleDuration('8 min', 1.1)).toBe('9 min');
  });
  it('escala rangos a múltiplos de 5 a partir de 20', () => {
    expect(scaleDuration('75-90 min', 1.2)).toBe('90-110 min');
  });
  it('deja intacto lo no parseable', () => {
    expect(scaleDuration('hasta fallo', 1.2)).toBe('hasta fallo');
  });
});

describe('scaleDistance', () => {
  it('escala metros a múltiplos de 25', () => {
    expect(scaleDistance('100m', 1.2)).toBe('125m');
    expect(scaleDistance('100m', 0.8)).toBe('75m');
  });
  it('deja intacto lo no parseable', () => {
    expect(scaleDistance('2 largos', 1.2)).toBe('2 largos');
  });
});

describe('scaleExercise', () => {
  it('escala sets a enteros >= 1', () => {
    expect(scaleExercise(day.exercises![0], 0.6).sets).toBe(2);
    expect(scaleExercise({ id: 'x', name: 'x', sets: 1 }, 0.6).sets).toBe(1);
  });
  it('no toca reps ni load', () => {
    const scaled = scaleExercise(day.exercises![3], 1.2);
    expect(scaled.reps).toBe('8 por lado');
    expect(scaled.load).toBe('60-80% 1RM');
  });
});

describe('scaleDayPlan', () => {
  it('escala la duración total a múltiplos de 5', () => {
    expect(scaleDayPlan(day, 1.2).duration).toBe(70);
  });
  it('con factor 1 devuelve el día tal cual', () => {
    expect(scaleDayPlan(day, 1)).toBe(day);
  });
  it('no toca los días de descanso', () => {
    const rest: DayPlan = { ...day, sessionType: 'rest', duration: 0, exercises: [] };
    expect(scaleDayPlan(rest, 1.2)).toBe(rest);
  });
});

describe('buildWeeks', () => {
  it('genera 4 semanas con foco y descarga final', () => {
    const weeks = buildWeeks([day]);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(weeks[3].focus).toBe('Descarga');
    const setsOf = (i: number) => weeks[i].days[0].exercises![0].sets!;
    expect(setsOf(3)).toBeLessThan(setsOf(0));
    expect(setsOf(2)).toBeGreaterThanOrEqual(setsOf(0));
  });
});

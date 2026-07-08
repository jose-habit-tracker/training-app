import { describe, expect, it } from 'vitest';
import {
  currentWeekIndex,
  defaultPlanData,
  mondayOfCurrentWeek,
  normalizePlanData,
  planFinished,
} from '../../lib/training/planData';
import type { DayPlan, PlanDataV2 } from '../../types';

const legacyDays: DayPlan[] = [
  { day: 'monday', dayName: 'Lunes', sessionType: 'running_easy', title: 'x', duration: 40, description: 'x' },
];

describe('normalizePlanData', () => {
  it('convierte el formato legacy en 4 semanas idénticas sin perfil', () => {
    const data = normalizePlanData(legacyDays);
    expect(data?.version).toBe(2);
    expect(data?.profile).toBeNull();
    expect(data?.weeks).toHaveLength(4);
    expect(data?.weeks[2].days).toEqual(legacyDays);
  });

  it('deja pasar v2 tal cual', () => {
    const v2: PlanDataV2 = { version: 2, profile: null, weeks: defaultPlanData().weeks };
    expect(normalizePlanData(v2)).toBe(v2);
  });

  it('devuelve null para datos inválidos', () => {
    expect(normalizePlanData(null)).toBeNull();
    expect(normalizePlanData([])).toBeNull();
    expect(normalizePlanData({ version: 1 })).toBeNull();
    expect(normalizePlanData({ version: 2, weeks: [] })).toBeNull();
  });
});

describe('semana actual', () => {
  const now = new Date('2026-07-08T12:00:00');
  it('calcula el índice desde start_date', () => {
    expect(currentWeekIndex('2026-07-06', 4, now)).toBe(0);
    expect(currentWeekIndex('2026-06-29', 4, now)).toBe(1);
  });
  it('acota a la última semana y detecta plan terminado', () => {
    expect(currentWeekIndex('2026-01-05', 4, now)).toBe(3);
    expect(planFinished('2026-01-05', 4, now)).toBe(true);
    expect(planFinished('2026-06-29', 4, now)).toBe(false);
  });
  it('sin start_date cae a la semana 1', () => {
    expect(currentWeekIndex(null, 4, now)).toBe(0);
    expect(planFinished(null, 4, now)).toBe(false);
  });
});

describe('mondayOfCurrentWeek', () => {
  it('devuelve el lunes de la semana en curso', () => {
    expect(mondayOfCurrentWeek(new Date('2026-07-08T12:00:00'))).toBe('2026-07-06');
    expect(mondayOfCurrentWeek(new Date('2026-07-06T12:00:00'))).toBe('2026-07-06');
    expect(mondayOfCurrentWeek(new Date('2026-07-12T12:00:00'))).toBe('2026-07-06');
  });
});

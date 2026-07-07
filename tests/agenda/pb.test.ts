import { describe, it, expect } from 'vitest';
import { isPersonalBest } from '../../lib/agenda/pb';
import type { CalendarEvent } from '../../types';

const race = (distance_km: number, result_time?: string): CalendarEvent => ({
  id: 'r', user_id: 'u', title: 'x', date: '2026-01-01', kind: 'race',
  race: { distance_km, result_time },
});

describe('isPersonalBest', () => {
  const history = [race(10, '43:58'), race(10, '41:32'), race(21.1, '1:35:00'), race(10)];

  it('PB si mejora el mejor tiempo previo en esa distancia', () => {
    expect(isPersonalBest(10, '41:00', history)).toBe(true);
    expect(isPersonalBest(10, '42:00', history)).toBe(false);
  });
  it('empate no es PB', () => {
    expect(isPersonalBest(10, '41:32', history)).toBe(false);
  });
  it('primera carrera en la distancia es PB', () => {
    expect(isPersonalBest(5, '20:00', history)).toBe(true);
  });
  it('tolera ±0.1 km al agrupar distancia', () => {
    expect(isPersonalBest(21.0975, '1:29:59', history)).toBe(true);
    expect(isPersonalBest(21.0975, '1:36:00', history)).toBe(false);
  });
});

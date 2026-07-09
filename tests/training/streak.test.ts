// tests/training/streak.test.ts
import { describe, it, expect } from 'vitest';
import { computeStreak } from '../../lib/training/streak';

// Jueves 2026-07-09. Mediodía UTC para que toISOString no cambie de día.
const TODAY = new Date('2026-07-09T12:00:00Z');
const noRest = () => false;
// Domingo descansa (como el plan real: sunday = active_recovery no es rest,
// pero el test usa un plan sintético con domingo de descanso).
const sundayRest = (dayKey: string) => dayKey === 'sunday';

describe('computeStreak', () => {
  it('sin sesiones devuelve 0', () => {
    expect(computeStreak([], noRest, TODAY)).toBe(0);
  });

  it('hoy y ayer registrados → 2', () => {
    expect(computeStreak(['2026-07-09', '2026-07-08'], noRest, TODAY)).toBe(2);
  });

  it('hoy sin registrar no rompe: cuenta desde ayer', () => {
    expect(computeStreak(['2026-07-08', '2026-07-07'], noRest, TODAY)).toBe(2);
  });

  it('un hueco en día planificado rompe la racha', () => {
    // 2026-07-08 (miércoles) sin sesión y planificado → solo cuenta hoy
    expect(computeStreak(['2026-07-09', '2026-07-07'], noRest, TODAY)).toBe(1);
  });

  it('el descanso del plan no rompe la racha', () => {
    // Domingo 2026-07-05 descansa; sesiones L-M-X-J alrededor + sábado
    const dates = ['2026-07-09', '2026-07-08', '2026-07-07', '2026-07-06', '2026-07-04'];
    expect(computeStreak(dates, sundayRest, TODAY)).toBe(5);
  });

  it('el descanso no suma aunque haya continuidad', () => {
    // Solo hoy + descanso ayer (sintético): racha = 1, no 2
    const restYesterday = (dayKey: string) => dayKey === 'wednesday';
    expect(computeStreak(['2026-07-09'], restYesterday, TODAY)).toBe(1);
  });
});

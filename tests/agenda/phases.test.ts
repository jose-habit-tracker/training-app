import { describe, it, expect } from 'vitest';
import { computePhases, phaseAt, compliancePct } from '../../lib/agenda/phases';

// Carrera 2026-10-25 (domingo). Su semana (lunes) empieza el 2026-10-19.
// Race: 19 oct. Taper: 2 sem antes (5 oct). Peak: 4 sem antes (7 sep). Build: 4 sem antes (10 ago).
describe('computePhases', () => {
  const phases = computePhases('2026-06-08', '2026-10-25');

  it('ancla cada fase hacia atrás desde la semana de carrera', () => {
    expect(phases.map((p) => [p.phase, p.start])).toEqual([
      ['base', '2026-06-08'],
      ['build', '2026-08-10'],
      ['peak', '2026-09-07'],
      ['taper', '2026-10-05'],
      ['race', '2026-10-19'],
    ]);
  });

  it('si el plan empieza tarde, recorta base (nunca fases negativas)', () => {
    const short = computePhases('2026-09-20', '2026-10-25');
    expect(short.find((p) => p.phase === 'base')).toBeUndefined();
    expect(short[0].start).toBe('2026-09-20');
  });
});

describe('phaseAt', () => {
  const phases = computePhases('2026-06-08', '2026-10-25');
  it('devuelve la fase de una fecha', () => {
    expect(phaseAt(phases, '2026-07-07')).toBe('base');
    expect(phaseAt(phases, '2026-10-24')).toBe('race');
  });
  it('null fuera de rango (carrera pasada)', () => {
    expect(phaseAt(phases, '2026-11-01')).toBeNull();
  });
});

describe('compliancePct', () => {
  it('completadas / planificadas, sin pasar de 100', () => {
    expect(compliancePct(6, 7)).toBe(86);
    expect(compliancePct(9, 7)).toBe(100);
    expect(compliancePct(0, 0)).toBe(0);
  });
});

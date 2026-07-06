import { describe, it, expect } from 'vitest';
import { validateProposal } from '../../lib/coach/validate';

describe('validateProposal', () => {
  it('acepta log_session válido y descarta campos extra', () => {
    const p = validateProposal('log_session', {
      session_date: '2026-07-06',
      session_type: 'running_threshold',
      subtype: 'threshold',
      duration_min: 55,
      rpe: 7,
      fatigue: 6,
      notes: 'piernas cargadas',
      metrics: { distancia_km: 12.5, ritmo_min_km: '4:24', hack: 'x' },
      evil_extra: true,
    });
    expect(p).not.toBeNull();
    if (p?.action !== 'log_session') throw new Error('acción incorrecta');
    expect(p.args.session_type).toBe('running_threshold');
    expect(p.args.metrics).toEqual({ distancia_km: 12.5, ritmo_min_km: '4:24' });
    expect('evil_extra' in p.args).toBe(false);
  });

  it('rechaza log_session sin fecha válida o sin tipo', () => {
    expect(validateProposal('log_session', { session_type: 'swimming' })).toBeNull();
    expect(validateProposal('log_session', { session_date: '6/7/26', session_type: 'swimming' })).toBeNull();
    expect(validateProposal('log_session', { session_date: '2026-07-06', session_type: 'yoga' })).toBeNull();
  });

  it('acota rpe/fatigue a 1..10 y duración a 1..600 (fuera de rango → descartado)', () => {
    const p = validateProposal('log_session', {
      session_date: '2026-07-06',
      session_type: 'swimming',
      rpe: 17,
      fatigue: 0,
      duration_min: 5000,
    });
    if (p?.action !== 'log_session') throw new Error('acción incorrecta');
    expect(p.args.rpe).toBeUndefined();
    expect(p.args.fatigue).toBeUndefined();
    expect(p.args.duration_min).toBeUndefined();
  });

  it('edit_session exige fecha y al menos un campo a cambiar', () => {
    expect(validateProposal('edit_session', { session_date: '2026-07-05' })).toBeNull();
    const p = validateProposal('edit_session', { session_date: '2026-07-05', rpe: 8 });
    expect(p?.action).toBe('edit_session');
  });

  it('delete_session solo necesita fecha', () => {
    expect(validateProposal('delete_session', { session_date: '2026-07-05' })?.action).toBe('delete_session');
    expect(validateProposal('delete_session', {})).toBeNull();
  });

  it('adjust_plan exige array days no vacío con day válido', () => {
    expect(validateProposal('adjust_plan', { days: [] })).toBeNull();
    expect(validateProposal('adjust_plan', { days: [{ day: 'funday' }] })).toBeNull();
    const p = validateProposal('adjust_plan', { days: [{ day: 'saturday', duration: 90 }] });
    expect(p?.action).toBe('adjust_plan');
  });

  it('métricas de natación y gym se sanean elemento a elemento', () => {
    const p = validateProposal('log_session', {
      session_date: '2026-07-06',
      session_type: 'swimming',
      metrics: {
        metros: 2000,
        series: [{ reps: 8, distancia_m: 50 }, { reps: 'x', distancia_m: 100 }],
        ejercicios: [{ nombre: 'Sentadilla', series: 4, reps: '8', kg: 80 }, { series: 3 }],
      },
    });
    if (p?.action !== 'log_session') throw new Error('acción incorrecta');
    expect(p.args.metrics?.series).toEqual([{ reps: 8, distancia_m: 50 }]);
    expect(p.args.metrics?.ejercicios).toEqual([{ nombre: 'Sentadilla', series: 4, reps: '8', kg: 80 }]);
  });

  it('acción desconocida → null', () => {
    expect(validateProposal('drop_tables', {})).toBeNull();
  });
});

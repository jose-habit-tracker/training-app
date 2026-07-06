import { describe, it, expect } from 'vitest';
import { buildGreeting } from '../../lib/coach/greeting';
import type { DayPlan, TrainingSession } from '../../types';

const plan: DayPlan = {
  day: 'monday', dayName: 'Lunes', sessionType: 'running_threshold',
  title: 'Running Umbral', duration: 60, description: 'Umbral',
};

describe('buildGreeting', () => {
  it('incluye sesión del día, duración y semana/fase', () => {
    const g = buildGreeting(plan, 4, 'Base', null);
    expect(g).toContain('Running Umbral');
    expect(g).toContain('60');
    expect(g).toContain('Semana 4');
    expect(g).toContain('Base');
  });

  it('avisa si la última fatiga fue alta (>=7)', () => {
    const last = { fatigue: 8, session_date: '2026-07-05' } as TrainingSession;
    expect(buildGreeting(plan, 4, 'Base', last)).toContain('fatiga 8');
  });

  it('sin plan del día → mensaje genérico sin crash', () => {
    const g = buildGreeting(null, 4, 'Base', null);
    expect(g.length).toBeGreaterThan(10);
  });
});

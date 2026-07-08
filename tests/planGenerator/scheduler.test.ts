import { describe, expect, it } from 'vitest';
import { scheduleWeek, sessionCounts } from '../../lib/planGenerator/scheduler';
import type { OnboardingAnswers, SessionType } from '../../types';

const HARD: SessionType[] = ['running_intervals', 'running_threshold', 'hyrox_simulation'];

function answers(partial: Partial<OnboardingAnswers>): OnboardingAnswers {
  return {
    sports: ['run'],
    goal: 'general_fitness',
    daysPerWeek: 4,
    level: 'intermediate',
    ...partial,
  };
}

describe('sessionCounts', () => {
  it('objetivo carrera prioriza el deporte de la carrera', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'gym'], goal: 'race', raceDistance: 'half' }), 5);
    expect(counts.get('run')).toBe(3);
    expect(counts.get('gym')).toBe(2);
  });
  it('ganar fuerza prioriza gimnasio', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'gym'], goal: 'gain_strength' }), 4);
    expect(counts.get('gym')!).toBeGreaterThan(counts.get('run')!);
  });
  it('garantiza 1 día por deporte cuando caben todos', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'swim', 'gym', 'hyrox'], goal: 'race', raceDistance: 'half' }), 4);
    for (const sport of ['run', 'swim', 'gym', 'hyrox'] as const) {
      expect(counts.get(sport)!).toBeGreaterThanOrEqual(1);
    }
  });
  it('si no caben todos, gana el de más peso', () => {
    const counts = sessionCounts(answers({ sports: ['run', 'swim', 'gym', 'hyrox'], goal: 'gain_strength' }), 2);
    expect(counts.get('gym')).toBe(1);
    expect(counts.get('hyrox')).toBe(1);
    expect(counts.get('run')).toBe(0);
    expect(counts.get('swim')).toBe(0);
  });
});

describe('scheduleWeek', () => {
  it('devuelve 7 días con tantas sesiones activas como días pedidos', () => {
    for (const daysPerWeek of [3, 4, 5, 6, 7]) {
      const week = scheduleWeek(answers({ sports: ['run', 'gym'], daysPerWeek }));
      expect(week).toHaveLength(7);
      expect(week.filter((s) => s !== 'rest')).toHaveLength(daysPerWeek);
    }
  });

  it('todos los deportes elegidos aparecen cuando caben', () => {
    const week = scheduleWeek(answers({ sports: ['run', 'swim', 'gym', 'hyrox'], daysPerWeek: 5 }));
    expect(week).toContain('swimming');
    expect(week).toContain('gym_strength');
    expect(week.some((s) => s.startsWith('running'))).toBe(true);
    expect(week.some((s) => s === 'gym_hyrox' || s === 'hyrox_simulation')).toBe(true);
  });

  it('con 6-7 días hay recuperación activa en domingo', () => {
    const week = scheduleWeek(answers({ sports: ['run'], daysPerWeek: 7 }));
    expect(week[6]).toBe('active_recovery');
  });

  it('la tirada larga cae en sábado si hay running con 2+ días', () => {
    const week = scheduleWeek(answers({ sports: ['run'], daysPerWeek: 4, goal: 'race', raceDistance: 'half' }));
    expect(week[5]).toBe('running_long');
  });

  it('sin dos días duros consecutivos', () => {
    const combos: Array<Partial<OnboardingAnswers>> = [
      { sports: ['run'], daysPerWeek: 7, goal: 'race', raceDistance: 'half' },
      { sports: ['run', 'hyrox'], daysPerWeek: 6, goal: 'race', raceDistance: 'hyrox' },
      { sports: ['run', 'swim', 'gym', 'hyrox'], daysPerWeek: 7 },
      { sports: ['run', 'gym'], daysPerWeek: 5, goal: 'lose_weight' },
    ];
    for (const combo of combos) {
      const week = scheduleWeek(answers(combo));
      for (let i = 0; i < 6; i++) {
        const both = HARD.includes(week[i]) && HARD.includes(week[i + 1]);
        expect(both, `duros seguidos en ${JSON.stringify(combo)}: ${week.join(',')}`).toBe(false);
      }
    }
  });
});

// tests/training/blocks.test.ts
import { describe, it, expect } from 'vitest';
import { deriveBlocks } from '../../lib/training/blocks';
import { DayPlan } from '../../types';

function day(partial: Partial<DayPlan>): DayPlan {
  return {
    day: 'thursday',
    dayName: 'Jueves',
    sessionType: 'running_intervals',
    title: 'Intervalos VO2max',
    duration: 55,
    description: '6x800m ritmo 5K, rec 2min',
    ...partial,
  };
}

describe('deriveBlocks', () => {
  it('devuelve warmup, principal y cooldown cuando existen', () => {
    const blocks = deriveBlocks(day({ warmup: '15 min suave', cooldown: '10 min trote' }));
    expect(blocks.map((b) => b.key)).toEqual(['warmup', 'main', 'cooldown']);
    expect(blocks[0]).toEqual({ key: 'warmup', label: 'Calentamiento', detail: '15 min suave' });
    expect(blocks[1].detail).toBe('6x800m ritmo 5K, rec 2min');
    expect(blocks[2].label).toBe('Enfriamiento');
  });

  it('omite bloques sin contenido', () => {
    const blocks = deriveBlocks(day({ warmup: '  ', cooldown: undefined }));
    expect(blocks.map((b) => b.key)).toEqual(['main']);
  });

  it('resume ejercicios en el bloque principal si existen', () => {
    const blocks = deriveBlocks(day({
      exercises: [
        { id: '1', name: 'Sentadilla' },
        { id: '2', name: 'Press banca' },
      ],
    }));
    expect(blocks.find((b) => b.key === 'main')?.detail).toBe('2 ejercicios');
  });

  it('singular para un ejercicio', () => {
    const blocks = deriveBlocks(day({ exercises: [{ id: '1', name: 'Sentadilla' }] }));
    expect(blocks.find((b) => b.key === 'main')?.detail).toBe('1 ejercicio');
  });

  it('día de descanso no tiene bloques', () => {
    expect(deriveBlocks(day({ sessionType: 'rest' }))).toEqual([]);
  });

  it('sin warmup, description ni exercises devuelve vacío', () => {
    expect(deriveBlocks(day({ description: '' }))).toEqual([]);
  });
});

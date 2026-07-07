import { describe, it, expect } from 'vitest';
import { editorSportOf, EDITOR_SPORTS, EXERCISE_FIELDS } from '../../lib/training/fields';

describe('editorSportOf', () => {
  it('mapea cada SessionType a su deporte de editor', () => {
    expect(editorSportOf('running_threshold')).toBe('run');
    expect(editorSportOf('swimming')).toBe('swim');
    expect(editorSportOf('gym_hyrox')).toBe('gym');
    expect(editorSportOf('hyrox_simulation')).toBe('hyrox');
    expect(editorSportOf('active_recovery')).toBe('rest');
  });
});

describe('EDITOR_SPORTS', () => {
  it('cubre los 10 SessionType sin repetir', () => {
    const all = EDITOR_SPORTS.flatMap((s) => s.types);
    expect(all).toHaveLength(10);
    expect(new Set(all).size).toBe(10);
  });
});

describe('EXERCISE_FIELDS', () => {
  it('natación no muestra carga y sí distancia con presets', () => {
    const keys = EXERCISE_FIELDS.swim.map((f) => f.key);
    expect(keys).not.toContain('load');
    expect(keys).toContain('distance');
    const rest = EXERCISE_FIELDS.swim.find((f) => f.key === 'rest');
    expect(rest?.presets).toContain('30s');
  });
  it('gym muestra carga y no distancia', () => {
    const keys = EXERCISE_FIELDS.gym.map((f) => f.key);
    expect(keys).toContain('load');
    expect(keys).not.toContain('distance');
  });
});

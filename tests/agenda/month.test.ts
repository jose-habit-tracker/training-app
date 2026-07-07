import { describe, it, expect } from 'vitest';
import { monthGrid, monthLabel } from '../../lib/agenda/month';

describe('monthGrid', () => {
  // Julio 2026: miércoles 1 → la primera semana empieza en lunes 29 de junio.
  const grid = monthGrid(2026, 6);

  it('empieza en lunes y las semanas son de 7', () => {
    expect(grid[0][0].iso).toBe('2026-06-29');
    expect(grid[0][0].inMonth).toBe(false);
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
  it('contiene todos los días del mes marcados inMonth', () => {
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].iso).toBe('2026-07-01');
    expect(inMonth[30].iso).toBe('2026-07-31');
  });
});

describe('monthLabel', () => {
  it('etiqueta en español', () => {
    expect(monthLabel(2026, 6).toLowerCase()).toContain('julio');
  });
});

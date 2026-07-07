import { describe, it, expect } from 'vitest';
import { parseClock, formatClock, paceMinKm } from '../../lib/agenda/time';

describe('parseClock', () => {
  it('parsea h:mm:ss y mm:ss a segundos', () => {
    expect(parseClock('1:29:59')).toBe(5399);
    expect(parseClock('41:32')).toBe(2492);
  });
  it('devuelve null si es inválido', () => {
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('1:75:00')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});

describe('formatClock', () => {
  it('formatea con y sin horas', () => {
    expect(formatClock(5399)).toBe('1:29:59');
    expect(formatClock(2492)).toBe('41:32');
  });
});

describe('paceMinKm', () => {
  it('deriva el ritmo min/km', () => {
    expect(paceMinKm(5399, 21.1)).toBe('4:16');
    expect(paceMinKm(2492, 10)).toBe('4:09');
  });
  it('null con distancia 0', () => {
    expect(paceMinKm(2492, 0)).toBeNull();
  });
});

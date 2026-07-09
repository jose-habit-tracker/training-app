// tests/agenda/countdown.test.ts
import { describe, it, expect } from 'vitest';
import { nextRace, daysUntil } from '../../lib/agenda/countdown';
import { CalendarEvent } from '../../types';

function ev(partial: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'x', user_id: 'u', title: 'Evento', date: '2026-10-11', kind: 'race', ...partial };
}

describe('nextRace', () => {
  it('devuelve la carrera futura más cercana, ignorando eventos no-carrera', () => {
    const events = [
      ev({ id: 'a', date: '2026-12-05' }),
      ev({ id: 'b', date: '2026-10-11' }),
      ev({ id: 'c', date: '2026-09-01', kind: 'event' }),
    ];
    expect(nextRace(events, '2026-07-09')?.id).toBe('b');
  });

  it('ignora carreras pasadas', () => {
    expect(nextRace([ev({ date: '2026-07-08' })], '2026-07-09')).toBeNull();
  });

  it('una carrera hoy cuenta como próxima', () => {
    expect(nextRace([ev({ date: '2026-07-09' })], '2026-07-09')?.date).toBe('2026-07-09');
  });

  it('sin eventos devuelve null', () => {
    expect(nextRace([], '2026-07-09')).toBeNull();
  });
});

describe('daysUntil', () => {
  it('cuenta días de calendario', () => {
    expect(daysUntil('2026-10-11', '2026-07-09')).toBe(94);
  });

  it('hoy es 0', () => {
    expect(daysUntil('2026-07-09', '2026-07-09')).toBe(0);
  });
});

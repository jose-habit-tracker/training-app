// lib/agenda/countdown.ts
import { CalendarEvent } from '../../types';

export function nextRace(events: CalendarEvent[], todayIso: string): CalendarEvent | null {
  const upcoming = events
    .filter((e) => e.kind === 'race' && e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

export function daysUntil(dateIso: string, todayIso: string): number {
  const ms = Date.parse(`${dateIso}T00:00:00`) - Date.parse(`${todayIso}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

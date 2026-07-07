import type { CalendarEvent } from '../../types';
import { parseClock } from './time';

// PB = estrictamente mejor que todo resultado previo en la misma distancia (±0.1 km).
export function isPersonalBest(distanceKm: number, resultTime: string, history: CalendarEvent[]): boolean {
  const seconds = parseClock(resultTime);
  if (seconds === null) return false;

  const previous = history
    .filter((e) => e.kind === 'race' && e.race?.result_time && Math.abs(e.race.distance_km - distanceKm) <= 0.1)
    .map((e) => parseClock(e.race!.result_time!))
    .filter((s): s is number => s !== null);

  return previous.every((prev) => seconds < prev);
}

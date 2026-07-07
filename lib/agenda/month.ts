export interface MonthCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().split('T')[0];

// month es 0-index (6 = julio). Semanas lunes→domingo cubriendo el mes completo.
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY_MS);
  const weeks: MonthCell[][] = [];
  let cursor = start;

  while (cursor.getUTCMonth() === month || weeks.length === 0 || cursor <= new Date(Date.UTC(year, month + 1, 0))) {
    const week: MonthCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ iso: iso(cursor), day: cursor.getUTCDate(), inMonth: cursor.getUTCMonth() === month });
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    weeks.push(week);
    if (cursor.getUTCMonth() !== month) break;
  }
  return weeks;
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('es-ES', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

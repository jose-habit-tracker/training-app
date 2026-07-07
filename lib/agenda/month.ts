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

  while (weeks.length === 0 || cursor.getUTCMonth() === month) {
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

// Array estático porque Intl en Hermes (builds nativas de Expo) puede venir
// incompleto y toLocaleDateString no garantiza los nombres de mes en español.
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} de ${year}`;
}

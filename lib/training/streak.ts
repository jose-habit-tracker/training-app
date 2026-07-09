const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Racha de días cumpliendo el plan, caminando hacia atrás desde `today`.
// Los descansos del plan mantienen la racha sin sumar; hoy sin registrar se salta.
export function computeStreak(
  sessionDates: Iterable<string>,
  isRestDay: (dayKey: string) => boolean,
  today: Date = new Date(),
): number {
  const dates = new Set(sessionDates);
  const cursor = new Date(today);

  if (!dates.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let i = 0; i < 366; i++) {
    if (dates.has(iso(cursor))) streak++;
    else if (!isRestDay(DAY_KEYS[cursor.getDay()])) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

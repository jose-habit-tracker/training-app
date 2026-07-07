// "1:29:59" o "41:32" → segundos; null si no cuadra.
export function parseClock(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hasHours = m[3] !== undefined;
  const h = hasHours ? Number(m[1]) : 0;
  const min = hasHours ? Number(m[2]) : Number(m[1]);
  const sec = hasHours ? Number(m[3]) : Number(m[2]);
  // Más de 59 minutos se expresa siempre como h:mm:ss — "75:00" es inválido a propósito.
  if (min > 59 || sec > 59) return null;
  return h * 3600 + min * 60 + sec;
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  const mm = h > 0 ? String(min).padStart(2, '0') : String(min);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

// Ritmo redondeado al segundo: "4:16" min/km.
export function paceMinKm(totalSeconds: number, distanceKm: number): string | null {
  if (distanceKm <= 0) return null;
  const secPerKm = Math.round(totalSeconds / distanceKm);
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}`;
}

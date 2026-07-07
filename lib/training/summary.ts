import type { ExerciseTemplate } from '../../types';
import type { EditorSport } from './fields';

// Resumen de una línea para la cabecera colapsada del acordeón.
export function exerciseSummary(ex: ExerciseTemplate): string {
  const parts: string[] = [];
  const volume = ex.distance ?? ex.reps ?? ex.duration;
  if (ex.sets != null && volume) parts.push(`${ex.sets}×${volume}`);
  else if (volume) parts.push(volume);
  if (ex.load) parts.push(ex.load);
  if (ex.rest) parts.push(`desc ${ex.rest}`);
  return parts.join(' · ');
}

// Formato es-ES explícito: toLocaleString('es-ES') no agrupa hasta 10.000
// (minimumGroupingDigits de CLDR), pero aquí queremos "1.300".
function formatEs(value: number): string {
  const [int, frac] = value.toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return frac ? `${grouped},${frac}` : grouped;
}

function metersOf(ex: ExerciseTemplate): number {
  const m = ex.distance?.match(/^(\d+(?:[.,]\d+)?)\s*(m|km)$/i);
  if (!m) return 0;
  const value = parseFloat(m[1].replace(',', '.'));
  const meters = m[2].toLowerCase() === 'km' ? value * 1000 : value;
  return meters * (ex.sets ?? 1);
}

export function sessionTotals(exercises: ExerciseTemplate[], sport: EditorSport): string {
  if (exercises.length === 0) return '';
  if (sport === 'swim' || sport === 'run') {
    const total = exercises.reduce((sum, ex) => sum + metersOf(ex), 0);
    if (total === 0) return `${exercises.length} bloques`;
    if (sport === 'run' && total >= 1000) return `${formatEs(total / 1000)} km totales`;
    return `${formatEs(total)} m totales`;
  }
  return `${exercises.length} ejercicios`;
}

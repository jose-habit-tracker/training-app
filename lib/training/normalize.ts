import type { ExerciseTemplate } from '../../types';

// Los seeds antiguos guardaban el volumen como reps "6x50m" (natación) o
// "4x8 min" (running); los editores de natación y running trabajan con
// sets + distance / sets + duration. Migra al vuelo sin perder datos, tanto
// para plantillas nuevas como para planes ya guardados en Supabase.
export function normalizeLegacyExercises(exercises: ExerciseTemplate[]): ExerciseTemplate[] {
  return exercises.map((ex) => {
    if (ex.sets != null || ex.distance || ex.duration || !ex.reps) return ex;

    const distanceMatch = ex.reps.match(/^(\d+)\s*[x×]\s*(\d+)\s*m$/i);
    if (distanceMatch) {
      const { reps: _legacy, ...rest } = ex;
      return { ...rest, sets: Number(distanceMatch[1]), distance: `${distanceMatch[2]}m` };
    }

    const durationMatch = ex.reps.match(/^(\d+)\s*[x×]\s*(\d+)\s*min$/i);
    if (durationMatch) {
      const { reps: _legacy, ...rest } = ex;
      return { ...rest, sets: Number(durationMatch[1]), duration: `${durationMatch[2]} min` };
    }

    return ex;
  });
}

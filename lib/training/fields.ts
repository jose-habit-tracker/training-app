import type { SessionType } from '../../types';

export type EditorSport = 'run' | 'swim' | 'gym' | 'hyrox' | 'rest';

export interface EditorSportDef {
  key: EditorSport;
  label: string;
  icon: string;
  types: SessionType[];
}

export const EDITOR_SPORTS: EditorSportDef[] = [
  { key: 'run', label: 'Run', icon: '🏃', types: ['running_easy', 'running_threshold', 'running_long', 'running_intervals'] },
  { key: 'swim', label: 'Swim', icon: '🏊', types: ['swimming'] },
  { key: 'gym', label: 'Gym', icon: '🏋️', types: ['gym_strength', 'gym_hyrox'] },
  { key: 'hyrox', label: 'Hyrox', icon: '⚡', types: ['hyrox_simulation'] },
  { key: 'rest', label: 'Descanso', icon: '😌', types: ['rest', 'active_recovery'] },
];

export function editorSportOf(type: SessionType): EditorSport {
  const def = EDITOR_SPORTS.find((s) => s.types.includes(type));
  return def?.key ?? 'rest';
}

export type ExerciseFieldKey = 'sets' | 'reps' | 'load' | 'distance' | 'duration' | 'rest' | 'notes';

export interface FieldSpec {
  key: ExerciseFieldKey;
  label: string;
  placeholder: string;
  numeric?: boolean;
  presets?: string[];
}

const REST_PRESETS = ['15s', '20s', '30s', '45s', '1 min', '2 min'];

// Qué campos de ExerciseTemplate se muestran por deporte, con etiquetas y atajos.
// Los presets rellenan el campo; la escritura manual siempre está disponible.
export const EXERCISE_FIELDS: Record<EditorSport, FieldSpec[]> = {
  swim: [
    { key: 'sets', label: 'Series', placeholder: '8', numeric: true },
    { key: 'distance', label: 'Distancia', placeholder: '100m', presets: ['25m', '50m', '100m', '200m', '400m'] },
    { key: 'rest', label: 'Descanso', placeholder: '30s', presets: REST_PRESETS },
    { key: 'notes', label: 'Estilo / foco', placeholder: 'Crol', presets: ['Crol', 'Espalda', 'Pull', 'Técnica', 'Pies'] },
  ],
  gym: [
    { key: 'sets', label: 'Series', placeholder: '4', numeric: true },
    { key: 'reps', label: 'Reps', placeholder: '8 por lado' },
    { key: 'load', label: 'Carga', placeholder: '40 kg', presets: ['Peso corporal', '10 kg', '20 kg', '40 kg', '60 kg'] },
    { key: 'rest', label: 'Descanso', placeholder: '90s', presets: REST_PRESETS },
    { key: 'notes', label: 'Notas', placeholder: 'Técnica sobre carga' },
  ],
  run: [
    { key: 'sets', label: 'Series', placeholder: '6', numeric: true },
    { key: 'distance', label: 'Distancia', placeholder: '400m', presets: ['200m', '400m', '1km', '2km'] },
    { key: 'duration', label: 'Duración', placeholder: '15 min', presets: ['5 min', '10 min', '15 min', '30 min'] },
    { key: 'rest', label: 'Descanso', placeholder: '2 min', presets: REST_PRESETS },
    { key: 'notes', label: 'Ritmo / foco', placeholder: 'z2 cómodo', presets: ['z1-z2', 'z3', 'umbral z4', '5k pace'] },
  ],
  hyrox: [
    { key: 'sets', label: 'Series', placeholder: '4', numeric: true },
    { key: 'reps', label: 'Reps', placeholder: '20' },
    { key: 'load', label: 'Carga', placeholder: '60 kg' },
    { key: 'distance', label: 'Distancia', placeholder: '1000m', presets: ['50m', '100m', '500m', '1000m'] },
    { key: 'duration', label: 'Duración', placeholder: '15 min' },
    { key: 'rest', label: 'Descanso', placeholder: '90s', presets: REST_PRESETS },
    { key: 'notes', label: 'Notas', placeholder: 'Ritmo constante' },
  ],
  rest: [
    { key: 'duration', label: 'Duración', placeholder: '10 min', presets: ['5 min', '10 min', '15 min'] },
    { key: 'notes', label: 'Notas', placeholder: 'Foam roller suave' },
  ],
};

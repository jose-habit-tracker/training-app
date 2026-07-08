export type SessionType =
  | 'running_easy'
  | 'running_threshold'
  | 'running_long'
  | 'running_intervals'
  | 'swimming'
  | 'gym_strength'
  | 'gym_hyrox'
  | 'hyrox_simulation'
  | 'rest'
  | 'active_recovery';

export type SessionSubtype =
  | 'easy'
  | 'long_run'
  | 'intervals'
  | 'threshold'
  | 'race'
  | 'swim_technique'
  | 'swim_sets'
  | 'strength'
  | 'hyrox_circuit'
  | 'recovery';

export type SportGroup = 'run' | 'swim' | 'gym' | 'other';

export interface SwimSet {
  reps: number;
  distancia_m: number;
  descripcion?: string;
}

export interface GymExerciseMetric {
  nombre: string;
  series: number;
  reps: string;
  kg?: number;
}

export interface SessionMetrics {
  distancia_km?: number;
  ritmo_min_km?: string; // "4:35"
  fc_media?: number;
  fc_max?: number;
  metros?: number;
  series?: SwimSet[];
  ejercicios?: GymExerciseMetric[];
}

export interface DayPlan {
  day: string;
  dayName: string;
  sessionType: SessionType;
  title: string;
  duration: number;
  description: string;
  exercises?: ExerciseTemplate[];
  warmup?: string;
  cooldown?: string;
  notes?: string;
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  sets?: number;
  reps?: string;
  load?: string;
  distance?: string;
  duration?: string;
  rest?: string;
  notes?: string;
}

export interface WeekPlan {
  week: number;
  phase: TrainingPhase;
  focus: string;
  days: DayPlan[];
}

export type TrainingPhase =
  | 'base'
  | 'build'
  | 'peak'
  | 'taper'
  | 'race'
  | 'hyrox_prep';

export interface TrainingPlan {
  id: string;
  user_id: string;
  name: string;
  phase: TrainingPhase;
  current_week: number;
  start_date: string;
  goal_race_date: string;
  plan_data: PlanDataV2 | DayPlan[]; // DayPlan[] = formato legacy pre-onboarding
  created_at: string;
}

export interface TrainingSession {
  id: string;
  user_id: string;
  plan_id?: string;
  session_date: string;
  day_name: string;
  week_number: number;
  session_type: SessionType;
  subtype?: SessionSubtype;
  metrics?: SessionMetrics;
  duration_min?: number;
  rpe_perceived?: number;
  fatigue?: number;
  notes?: string;
  ai_feedback?: string;
  completed_at?: string;
}

export interface ExerciseLog {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  completed: boolean;
  sets_actual?: number;
  load_actual?: string;
  notes?: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context_snapshot?: Record<string, unknown>;
  created_at: string;
}

export type UserRole = 'admin' | 'athlete';

export interface UserInvite {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  used_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ─── Agenda: eventos y carreras ──────────────────────────────────────────────

export interface RaceDetails {
  distance_km: number;
  target_time?: string;   // "1:29:59" — parsing en lib/agenda/time.ts
  result_time?: string;
  position?: number;
  feelings?: string;
  ai_analysis?: string;
  is_goal?: boolean;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  date: string;           // ISO yyyy-mm-dd
  end_date?: string | null;
  kind: 'race' | 'event';
  icon?: string | null;
  notes?: string | null;
  race?: RaceDetails | null;
  created_at?: string;
}

// ─── Onboarding y plan v2 ─────────────────────────────────────────────────────

export type SportChoice = 'run' | 'swim' | 'gym' | 'hyrox';

export type OnboardingGoal = 'race' | 'general_fitness' | 'lose_weight' | 'gain_strength';

export type RaceDistanceChoice = '5k' | '10k' | 'half' | 'marathon' | 'hyrox';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface OnboardingAnswers {
  sports: SportChoice[];
  goal: OnboardingGoal;
  raceDistance?: RaceDistanceChoice;
  raceDate?: string; // ISO yyyy-mm-dd
  daysPerWeek: number; // 3-7
  level: ExperienceLevel;
}

// plan_data v2: objeto con perfil + 4 semanas. El formato legacy (DayPlan[])
// se normaliza en memoria en lib/training/planData.ts.
export interface PlanDataV2 {
  version: 2;
  profile: OnboardingAnswers | null;
  weeks: WeekPlan[];
}

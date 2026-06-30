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
  plan_data: WeekPlan[];
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
  role: 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

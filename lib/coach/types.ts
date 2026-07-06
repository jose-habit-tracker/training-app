import type { SessionType, SessionSubtype, SessionMetrics, DayPlan } from '../../types';

export interface LogSessionArgs {
  session_date: string; // YYYY-MM-DD
  session_type: SessionType;
  subtype?: SessionSubtype;
  duration_min?: number;
  rpe?: number;
  fatigue?: number;
  notes?: string;
  metrics?: SessionMetrics;
}

// session_date identifica la sesión a editar; el resto son los campos a cambiar.
export type EditSessionArgs = { session_date: string } & Partial<Omit<LogSessionArgs, 'session_date'>>;

export interface DeleteSessionArgs {
  session_date: string;
}

// Días propuestos tal cual vienen del LLM; el merge/saneado fino lo hace planMerge.
export interface AdjustPlanArgs {
  days: Partial<DayPlan>[];
}

export type ActionProposal =
  | { action: 'log_session'; args: LogSessionArgs }
  | { action: 'edit_session'; args: EditSessionArgs }
  | { action: 'delete_session'; args: DeleteSessionArgs }
  | { action: 'adjust_plan'; args: AdjustPlanArgs };

export type CoachReply =
  | { kind: 'text'; content: string }
  | { kind: 'proposal'; content: string; proposal: ActionProposal };

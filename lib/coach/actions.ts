import { supabase } from '../supabase';
import { getWeekForDate } from '../../hooks/useTraining';
import type { DayPlan } from '../../types';
import type { ActionProposal, LogSessionArgs, EditSessionArgs } from './types';
import { applyProposedDays } from './planMerge';

export interface ExecutorContext {
  days: DayPlan[];
  savePlan: (next: DayPlan[]) => Promise<string | null>;
}

function dayNameFor(dateStr: string): string {
  const name = new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Mapea args del coach → columnas de training_sessions. Solo claves presentes.
function sessionColumns(args: Partial<LogSessionArgs>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (args.session_type !== undefined) cols.session_type = args.session_type;
  if (args.subtype !== undefined) cols.subtype = args.subtype;
  if (args.duration_min !== undefined) cols.duration_min = args.duration_min;
  if (args.rpe !== undefined) cols.rpe_perceived = args.rpe;
  if (args.fatigue !== undefined) cols.fatigue = args.fatigue;
  if (args.notes !== undefined) cols.notes = args.notes;
  if (args.metrics !== undefined) cols.metrics = args.metrics;
  return cols;
}

async function logSession(args: LogSessionArgs): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'No hay sesión activa';

  // Una sesión por día: actualiza si existe (mismo criterio que el formulario).
  const { data: existing } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_date', args.session_date)
    .maybeSingle();

  const fields = {
    ...sessionColumns(args),
    day_name: dayNameFor(args.session_date),
    week_number: getWeekForDate(args.session_date),
    completed_at: new Date().toISOString(),
  };

  const query = existing
    ? supabase.from('training_sessions').update(fields).eq('id', existing.id)
    : supabase.from('training_sessions').insert({
        user_id: user.id,
        session_date: args.session_date,
        ...fields,
      });

  const { error } = await query;
  return error ? error.message : null;
}

async function editSession(args: EditSessionArgs): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'No hay sesión activa';

  const { data: existing } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_date', args.session_date)
    .maybeSingle();
  if (!existing) return `No hay ninguna sesión registrada el ${args.session_date}`;

  const { session_date, ...rest } = args;
  const { error } = await supabase
    .from('training_sessions')
    .update(sessionColumns(rest))
    .eq('id', existing.id);
  return error ? error.message : null;
}

async function deleteSession(date: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'No hay sesión activa';

  const { data, error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('session_date', date)
    .select('id');
  if (error) return error.message;
  if (!data || data.length === 0) return `No hay ninguna sesión registrada el ${date}`;
  return null;
}

// Ejecuta una propuesta CONFIRMADA por el usuario. Devuelve null si OK,
// o el mensaje de error. Escribe siempre con la sesión del usuario (RLS).
export async function executeProposal(
  proposal: ActionProposal,
  ctx: ExecutorContext,
): Promise<string | null> {
  switch (proposal.action) {
    case 'log_session':
      return logSession(proposal.args);
    case 'edit_session':
      return editSession(proposal.args);
    case 'delete_session':
      return deleteSession(proposal.args.session_date);
    case 'adjust_plan':
      return ctx.savePlan(applyProposedDays(ctx.days, proposal.args.days as DayPlan[]));
  }
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarEvent } from '../types';

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error: err } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (err) setError(err.message);
    else setEvents((data ?? []) as CalendarEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // Devuelve el id creado para poder encadenar setGoalRace sin releer estado stale.
  const addEvent = useCallback(async (ev: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at'>): Promise<{ id: string | null; error: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null, error: 'No hay sesión activa' };
    const { data, error: err } = await supabase
      .from('events')
      .insert({ ...ev, user_id: user.id })
      .select('id')
      .single();
    if (err) return { id: null, error: err.message };
    await refetch();
    return { id: data.id as string, error: null };
  }, [refetch]);

  const updateEvent = useCallback(async (id: string, patch: Partial<CalendarEvent>): Promise<string | null> => {
    const { error: err } = await supabase.from('events').update(patch).eq('id', id);
    if (err) return err.message;
    await refetch();
    return null;
  }, [refetch]);

  const removeEvent = useCallback(async (id: string): Promise<string | null> => {
    const { error: err } = await supabase.from('events').delete().eq('id', id);
    if (err) return err.message;
    await refetch();
    return null;
  }, [refetch]);

  // Solo una carrera objetivo: desmarca las demás y sincroniza goal_race_date del plan.
  // Lee de la BD (no del estado) para funcionar justo después de un addEvent.
  const setGoalRace = useCallback(async (id: string): Promise<string | null> => {
    const { data: target, error: readErr } = await supabase
      .from('events').select('*').eq('id', id).maybeSingle();
    if (readErr || !target || !(target as CalendarEvent).race) return readErr?.message ?? 'La carrera no existe';
    const targetEvent = target as CalendarEvent;

    const { data: others } = await supabase
      .from('events').select('*').eq('kind', 'race').neq('id', id);
    for (const e of (others ?? []) as CalendarEvent[]) {
      if (e.race?.is_goal) {
        const err = (await supabase.from('events').update({ race: { ...e.race, is_goal: false } }).eq('id', e.id)).error;
        if (err) return err.message;
      }
    }
    const { error: err } = await supabase
      .from('events').update({ race: { ...targetEvent.race!, is_goal: true } }).eq('id', id);
    if (err) return err.message;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('training_plans').update({ goal_race_date: targetEvent.date }).eq('user_id', user.id);
    }
    await refetch();
    return null;
  }, [refetch]);

  return { events, loading, error, refetch, addEvent, updateEvent, removeEvent, setGoalRace };
}

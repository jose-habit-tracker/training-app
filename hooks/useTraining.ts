import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TrainingSession } from '../types';
import { WEEKLY_STRUCTURE } from '../constants/trainingPlan';

const DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

// Plan start = Monday 2025-06-09 (Week 1)
const PLAN_START = new Date('2025-06-09T00:00:00');

export function getCurrentWeek(): number {
  const diffMs = Date.now() - PLAN_START.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

export function getCurrentWeekDates(): { start: string; end: string } {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(monday), end: fmt(sunday) };
}

// ─── useToday ─────────────────────────────────────────────────────────────────
// Returns today's DayPlan + whether a session was already logged today
export function useToday() {
  const dayKey = DAY_MAP[new Date().getDay()];
  const plan = WEEKLY_STRUCTURE.find((d) => d.day === dayKey) ?? null;
  const weekNumber = getCurrentWeek();

  const [loggedSession, setLoggedSession] = useState<TrainingSession | null>(null);
  const [loadingLog, setLoadingLog] = useState(true);

  const refresh = useCallback(async () => {
    setLoadingLog(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingLog(false); return; }

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_date', today)
      .maybeSingle();

    setLoggedSession(data as TrainingSession | null);
    setLoadingLog(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { plan, weekNumber, dayKey, loggedSession, loadingLog, refresh };
}

// ─── useSessions ──────────────────────────────────────────────────────────────
// Full session history for the current user
export function useSessions(limit = 30) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error: err } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .limit(limit);

    if (err) setError(err.message);
    else setSessions((data ?? []) as TrainingSession[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => { refetch(); }, [refetch]);

  return { sessions, loading, error, refetch };
}

// ─── useWeekSessions ──────────────────────────────────────────────────────────
// Sessions from the current Monday–Sunday
export function useWeekSessions() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { start, end } = getCurrentWeekDates();
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', start)
      .lte('session_date', end)
      .order('session_date', { ascending: true });

    setSessions((data ?? []) as TrainingSession[]);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { sessions, loading, refetch };
}

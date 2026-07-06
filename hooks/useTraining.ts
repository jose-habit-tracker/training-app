import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TrainingSession } from '../types';
import { WEEKLY_STRUCTURE, TRAINING_PHASES } from '../constants/trainingPlan';

const DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

// Plan start = Monday 2025-06-09 (Week 1). Ajusta esta fecha para recalibrar el ciclo.
const PLAN_START = new Date('2025-06-09T00:00:00');
const PLAN_WEEKS = 20;

export function getCurrentWeek(): number {
  const diffMs = Date.now() - PLAN_START.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(PLAN_WEEKS, Math.max(1, week));
}

export function getWeekForDate(dateStr: string): number {
  const diffMs = new Date(`${dateStr}T00:00:00`).getTime() - PLAN_START.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(PLAN_WEEKS, Math.max(1, week));
}

const PHASE_LABEL: Record<keyof typeof TRAINING_PHASES, string> = {
  base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper', race: 'Carrera', hyrox_prep: 'Hyrox Prep',
};

export function getPhaseLabel(week: number): string {
  for (const [key, { weeks }] of Object.entries(TRAINING_PHASES)) {
    if ((weeks as readonly number[]).includes(week)) {
      return PHASE_LABEL[key as keyof typeof TRAINING_PHASES];
    }
  }
  return 'Base';
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

// lib/coach/dailyThread.ts
import { supabase } from '../supabase';

// Una conversación por usuario y día, titulada «Hoy · yyyy-mm-dd».
export async function getOrCreateDailyThread(userId: string, todayIso: string): Promise<string | null> {
  const title = `Hoy · ${todayIso}`;
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select('id')
    .single();
  return (created?.id as string) ?? null;
}

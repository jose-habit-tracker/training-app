import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { DayPlan } from '../types';
import { WEEKLY_STRUCTURE } from '../constants/trainingPlan';

interface PlanContextValue {
  days: DayPlan[];
  loading: boolean;
  save: (next: DayPlan[]) => Promise<string | null>;
}

const PlanContext = createContext<PlanContextValue>({
  days: WEEKLY_STRUCTURE,
  loading: true,
  save: async () => null,
});

// El plan vive en training_plans.plan_data (una fila por usuario). Si no existe,
// se usa el plan por defecto y se crea la fila al primer guardado.
export function PlanProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [days, setDays] = useState<DayPlan[]>(WEEKLY_STRUCTURE);
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const userId = session?.user?.id;
      if (!userId) {
        if (active) { setDays(WEEKLY_STRUCTURE); setPlanId(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('training_plans')
        .select('id, plan_data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (data?.plan_data && Array.isArray(data.plan_data) && data.plan_data.length) {
        setDays(data.plan_data as DayPlan[]);
        setPlanId(data.id);
      } else {
        setDays(WEEKLY_STRUCTURE);
        setPlanId(data?.id ?? null);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [session?.user?.id]);

  const save = useCallback(async (next: DayPlan[]): Promise<string | null> => {
    const userId = session?.user?.id;
    if (!userId) return 'No hay sesión activa';

    if (planId) {
      const { error } = await supabase
        .from('training_plans')
        .update({ plan_data: next })
        .eq('id', planId);
      if (error) return error.message;
    } else {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('training_plans')
        .insert({
          user_id: userId,
          name: 'Mi plan',
          phase: 'base',
          start_date: today,
          goal_race_date: today,
          plan_data: next,
        })
        .select('id')
        .single();
      if (error) return error.message;
      setPlanId(data.id);
    }
    setDays(next);
    return null;
  }, [session?.user?.id, planId]);

  return (
    <PlanContext.Provider value={{ days, loading, save }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);

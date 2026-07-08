import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { DayPlan, PlanDataV2, WeekPlan } from '../types';
import {
  currentWeekIndex as computeWeekIndex,
  defaultPlanData,
  mondayOfCurrentWeek,
  normalizePlanData,
  planFinished as computePlanFinished,
} from './training/planData';

interface PlanContextValue {
  weeks: WeekPlan[];
  days: DayPlan[];
  weekIndex: number;
  currentWeekIndex: number;
  planFinished: boolean;
  setWeekIndex: (i: number) => void;
  loading: boolean;
  hasPlan: boolean;
  save: (next: DayPlan[], targetIndex?: number) => Promise<string | null>;
  replacePlan: (data: PlanDataV2) => Promise<string | null>;
}

const PlanContext = createContext<PlanContextValue>({
  weeks: defaultPlanData().weeks,
  days: defaultPlanData().weeks[0].days,
  weekIndex: 0,
  currentWeekIndex: 0,
  planFinished: false,
  setWeekIndex: () => {},
  loading: true,
  hasPlan: false,
  save: async () => null,
  replacePlan: async () => null,
});

// El plan vive en training_plans.plan_data (una fila por usuario). El formato
// legacy (DayPlan[]) se normaliza en memoria; se reescribe como v2 al guardar.
export function PlanProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [planData, setPlanData] = useState<PlanDataV2>(defaultPlanData());
  const [planId, setPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weekIndex, setWeekIndexState] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const userId = session?.user?.id;
      if (!userId) {
        if (active) {
          setPlanData(defaultPlanData());
          setPlanId(null);
          setStartDate(null);
          setHasPlan(false);
          setWeekIndexState(0);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from('training_plans')
        .select('id, plan_data, start_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      const normalized = normalizePlanData(data?.plan_data);
      if (normalized) {
        setPlanData(normalized);
        setStartDate((data?.start_date as string) ?? null);
        setHasPlan(true);
        setWeekIndexState(computeWeekIndex(data?.start_date as string, normalized.weeks.length));
      } else {
        setPlanData(defaultPlanData());
        setStartDate(null);
        setHasPlan(false);
        setWeekIndexState(0);
      }
      setPlanId(data?.id ?? null);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [session?.user?.id]);

  const persist = useCallback(async (nextData: PlanDataV2, nextStartDate?: string): Promise<string | null> => {
    const userId = session?.user?.id;
    if (!userId) return 'No hay sesión activa';

    if (planId) {
      const patch: { plan_data: PlanDataV2; start_date?: string; phase?: string } = { plan_data: nextData };
      if (nextStartDate) { patch.start_date = nextStartDate; patch.phase = 'base'; }
      const { error } = await supabase.from('training_plans').update(patch).eq('id', planId);
      if (error) return error.message;
    } else {
      const start = nextStartDate ?? mondayOfCurrentWeek();
      const { data, error } = await supabase
        .from('training_plans')
        .insert({
          user_id: userId,
          name: 'Mi plan',
          phase: 'base',
          start_date: start,
          goal_race_date: start,
          plan_data: nextData,
        })
        .select('id')
        .single();
      if (error) return error.message;
      setPlanId(data.id);
    }
    setPlanData(nextData);
    setHasPlan(true);
    if (nextStartDate) setStartDate(nextStartDate);
    return null;
  }, [session?.user?.id, planId]);

  // targetIndex permite a Hoy escribir en la semana actual aunque el usuario
  // haya dejado otra semana seleccionada en la pestaña Semana.
  const save = useCallback(async (next: DayPlan[], targetIndex?: number): Promise<string | null> => {
    const idx = targetIndex ?? weekIndex;
    const nextData: PlanDataV2 = {
      ...planData,
      weeks: planData.weeks.map((w, i) => (i === idx ? { ...w, days: next } : w)),
    };
    return persist(nextData);
  }, [planData, weekIndex, persist]);

  const replacePlan = useCallback(async (data: PlanDataV2): Promise<string | null> => {
    const start = mondayOfCurrentWeek();
    const err = await persist(data, start);
    if (!err) setWeekIndexState(0);
    return err;
  }, [persist]);

  const setWeekIndex = useCallback((i: number) => {
    setWeekIndexState((prev) => {
      const max = planData.weeks.length - 1;
      const next = Math.min(max, Math.max(0, i));
      return next === prev ? prev : next;
    });
  }, [planData.weeks.length]);

  const currentIdx = computeWeekIndex(startDate, planData.weeks.length);
  const days = planData.weeks[weekIndex]?.days ?? planData.weeks[0].days;

  return (
    <PlanContext.Provider
      value={{
        weeks: planData.weeks,
        days,
        weekIndex,
        currentWeekIndex: currentIdx,
        // Solo para planes salidos de la encuesta: a un plan legacy (sin profile)
        // con start_date antiguo no le aplica el «plan completado».
        planFinished: hasPlan && planData.profile != null && computePlanFinished(startDate, planData.weeks.length),
        setWeekIndex,
        loading,
        hasPlan,
        save,
        replacePlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);

// app/(tabs)/hoy.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SessionColors } from '../../constants/colors';
import { usePlan } from '../../lib/PlanContext';
import { useSessions, useWeekSessions } from '../../hooks/useTraining';
import { useEvents } from '../../hooks/useEvents';
import { DAY_MAP } from '../../lib/coach/context';
import { computeStreak } from '../../lib/training/streak';
import { nextRace, daysUntil } from '../../lib/agenda/countdown';
import { WEEKLY_STRUCTURE } from '../../constants/trainingPlan';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { NextLevelSplash, consumeSplashSlot } from '../../components/ui/NextLevelSplash';
import { HeroCard } from '../../components/training/HeroCard';
import { WeekStrip } from '../../components/training/WeekStrip';
import { StatTiles } from '../../components/training/StatTiles';
import { CoachPill } from '../../components/training/CoachPill';

export default function HoyScreen() {
  const { colors } = useTheme();
  const { weeks, currentWeekIndex, setWeekIndex } = usePlan();
  const days = weeks[currentWeekIndex]?.days ?? [];
  const { sessions: weekSessions, refetch: refetchWeek } = useWeekSessions();
  const { sessions: recentSessions, refetch: refetchRecent } = useSessions(60);
  const { events } = useEvents();
  const [showSplash, setShowSplash] = useState(consumeSplashSlot);

  const todayKey = DAY_MAP[new Date().getDay()];
  const todayIso = new Date().toISOString().split('T')[0];
  const planToday =
    days.find((d) => d.day === todayKey) ??
    WEEKLY_STRUCTURE.find((d) => d.day === todayKey) ??
    null;
  const plannedThisWeek = days.filter((d) => d.sessionType !== 'rest').length;

  // Al volver del modal del coach, de registrar o de la sesión en vivo,
  // las tarjetas deben reflejar la sesión recién guardada.
  useFocusEffect(
    useCallback(() => {
      refetchWeek();
      refetchRecent();
    }, [refetchWeek, refetchRecent]),
  );

  const doneDayKeys = new Set(
    weekSessions.map((s) => DAY_MAP[new Date(`${s.session_date}T00:00:00`).getDay()]),
  );
  const race = nextRace(events, todayIso);
  const streak = computeStreak(
    recentSessions.map((s) => s.session_date),
    (dayKey) => days.find((d) => d.day === dayKey)?.sessionType === 'rest',
  );
  const rpes = weekSessions
    .map((s) => s.rpe_perceived)
    .filter((n): n is number => typeof n === 'number');
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <View style={[s.weekChip, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <Text style={[s.weekChipText, { color: colors.text3 }]}>
              Semana {currentWeekIndex + 1} · {weeks[currentWeekIndex]?.focus ?? 'Base'}
            </Text>
          </View>
          <ProgressRing done={weekSessions.length} total={plannedThisWeek} size={48} />
        </View>

        <HeroCard
          plan={planToday}
          onStart={() => router.push({ pathname: '/session/live', params: { day: todayKey } })}
          onLog={() => router.push({ pathname: '/log/[day]', params: { day: todayKey } })}
          onEditPlan={() => {
            setWeekIndex(currentWeekIndex);
            router.push('/plan');
          }}
        />

        <WeekStrip
          days={days}
          doneDayKeys={doneDayKeys}
          todayKey={todayKey}
          todayColor={SessionColors[planToday?.sessionType ?? 'rest']}
          onPressDay={() => {
            setWeekIndex(currentWeekIndex);
            router.push('/(tabs)/semana');
          }}
        />

        <StatTiles
          raceDays={race ? daysUntil(race.date, todayIso) : null}
          raceTitle={race?.title ?? null}
          streak={streak}
          avgRpe={avgRpe}
        />
      </ScrollView>

      <CoachPill onPress={() => router.push('/coach')} />

      {showSplash && <NextLevelSplash onDone={() => setShowSplash(false)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.gapSm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  weekChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs,
  },
  weekChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
});

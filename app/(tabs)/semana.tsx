import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SessionColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { DayPlan } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getCurrentWeek, getPhaseLabel, useWeekSessions } from '../../hooks/useTraining';
import { useTheme } from '../../hooks/useTheme';
import { usePlan } from '../../lib/PlanContext';

const DAY_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export default function SemanaScreen() {
  const { colors } = useTheme();
  const todayKey = DAY_MAP[new Date().getDay()];
  const week = getCurrentWeek();
  const { days } = usePlan();
  const { sessions: weekSessions } = useWeekSessions();
  const loggedDays = new Set(weekSessions.map((s) => s.day_name.toLowerCase()));

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Week header */}
        <View style={s.weekHeader}>
          <Text style={[s.weekTitle, { color: colors.text }]}>Esta semana</Text>
          <View style={[s.weekBadge, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderWidth: 1 }]}>
            <Text style={[s.weekBadgeText, { color: colors.text3 }]}>Semana {week} · Fase {getPhaseLabel(week)}</Text>
          </View>
        </View>

        <View style={s.progressStrip}>
          {days.map((d) => {
            const isDone = loggedDays.has(d.dayName.toLowerCase());
            const isToday = d.day === todayKey;
            return (
              <View
                key={d.day}
                style={[
                  s.progressDot,
                  {
                    backgroundColor: isDone
                      ? (SessionColors[d.sessionType] ?? colors.accent)
                      : colors.border,
                    borderWidth: isToday ? 2 : 0,
                    borderColor: colors.accent,
                  },
                ]}
              />
            );
          })}
        </View>

        <Button
          label="Editar plan"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/plan')}
          style={s.editBtn}
        />

        {days.map((day) => (
          <DayCard key={day.day} day={day} isToday={day.day === todayKey} colors={colors} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function DayCard({
  day,
  isToday,
  colors,
}: {
  day: DayPlan;
  isToday: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const accentColor = SessionColors[day.sessionType] ?? colors.accent;

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.glassBg,
          borderColor: isToday ? accentColor + '55' : colors.glassBorder,
          borderWidth: isToday ? 1.5 : 1,
        },
      ]}
    >
      {/* TODAY badge */}
      {isToday && (
        <View style={[s.todayBadge, { backgroundColor: accentColor }]}>
          <Text style={s.todayText}>HOY</Text>
        </View>
      )}

      <View style={s.cardHeader}>
        <View style={s.cardLeft}>
          <Text
            style={[
              s.dayName,
              { color: isToday ? accentColor : colors.text3 },
            ]}
          >
            {day.dayName.toUpperCase()}
          </Text>
          <Text style={[s.sessionTitle, { color: colors.text }]}>{day.title}</Text>
        </View>

        <View style={s.cardRight}>
          <View style={[s.colorDot, { backgroundColor: accentColor }]} />
          <Text style={[s.duration, { color: colors.text3 }]}>{day.duration} min</Text>
        </View>
      </View>

      <View style={[s.typePill, { backgroundColor: accentColor + '18' }]}>
        <Text style={[s.typeText, { color: accentColor }]}>
          {SESSION_LABELS[day.sessionType]}
        </Text>
      </View>

      <Text style={[s.description, { color: colors.text3 }]} numberOfLines={2}>
        {day.description}
      </Text>

      {day.exercises && day.exercises.length > 0 && (
        <Text style={[s.exerciseCount, { color: colors.text3 }]}>
          {day.exercises.length} ejercicios
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  weekTitle: { fontSize: 22, fontWeight: FontWeight.black, letterSpacing: -0.3 },
  weekBadge: {
    paddingHorizontal: Spacing.gapMd,
    paddingVertical: Spacing.gapXxs + 2,
    borderRadius: Radius.pill,
  },
  weekBadgeText: { fontSize: FontSize.base, fontWeight: FontWeight.label },

  editBtn: { marginBottom: Spacing.lg },
  progressStrip: { flexDirection: 'row', gap: Spacing.gapSm, marginBottom: Spacing.lg },
  progressDot: { flex: 1, height: 6, borderRadius: 3 },

  card: {
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.gapMd,
    overflow: 'hidden',
  },
  todayBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.gapMd,
    paddingVertical: Spacing.gapXxs + 1,
    borderBottomLeftRadius: Radius.md,
  },
  todayText: { fontSize: 10, fontWeight: FontWeight.black, color: '#fff', letterSpacing: 0.5 },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.gapMd,
  },
  cardLeft: { flex: 1 },
  dayName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  sessionTitle: { fontSize: 17, fontWeight: FontWeight.label },
  cardRight: { alignItems: 'flex-end', gap: Spacing.gapXxs },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  duration: { fontSize: FontSize.md, fontWeight: '500' },

  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.gapMd,
    paddingVertical: Spacing.gapXxs + 1,
    borderRadius: Radius.pill,
    marginBottom: Spacing.gapSm,
  },
  typeText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },

  description: { fontSize: FontSize.md, lineHeight: 18 },
  exerciseCount: { fontSize: FontSize.base, marginTop: Spacing.gapXs },
});

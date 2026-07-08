import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SessionColors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { usePlan } from '../../lib/PlanContext';
import { Button } from '../../components/ui/Button';

export default function PlanListScreen() {
  const { colors } = useTheme();
  const { days } = usePlan();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.hint, { color: colors.text3 }]}>
          Toca un día para editar su sesión y ejercicios. Los cambios se guardan en tu cuenta.
        </Text>

        {days.map((day) => {
          const accent = SessionColors[day.sessionType] ?? colors.accent;
          const exCount = day.exercises?.length ?? 0;
          return (
            <TouchableOpacity
              key={day.day}
              style={[s.row, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderLeftColor: accent }]}
              onPress={() => router.push(`/plan/${day.day}`)}
              activeOpacity={0.8}
            >
              <View style={s.rowMain}>
                <Text style={[s.dayName, { color: colors.text3 }]}>{day.dayName.toUpperCase()}</Text>
                <Text style={[s.title, { color: colors.text }]}>{day.title}</Text>
                <View style={s.meta}>
                  <View style={[s.pill, { backgroundColor: accent + '20' }]}>
                    <Text style={[s.pillText, { color: accent }]}>{SESSION_LABELS[day.sessionType] ?? day.sessionType}</Text>
                  </View>
                  <Text style={[s.metaText, { color: colors.text3 }]}>{day.duration} min · {exCount} ej.</Text>
                </View>
              </View>
              <Text style={[s.chevron, { color: colors.text3 }]}>›</Text>
            </TouchableOpacity>
          );
        })}

        <Button
          label="Rehacer encuesta y regenerar plan"
          variant="ghost"
          fullWidth
          onPress={() => router.push('/onboarding')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.gapSm },
  hint: { fontSize: FontSize.md, lineHeight: 18, marginBottom: Spacing.gapSm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: Radius.card,
    padding: Spacing.base,
  },
  rowMain: { flex: 1, gap: Spacing.gapXxs },
  dayName: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.5 },
  title: { fontSize: FontSize.body, fontWeight: FontWeight.black },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.gapSm, marginTop: 2 },
  pill: { paddingHorizontal: Spacing.gapMd, paddingVertical: 2, borderRadius: Radius.pill },
  pillText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  metaText: { fontSize: FontSize.base },
  chevron: { fontSize: 28, fontWeight: '300', marginLeft: Spacing.gapSm },
});

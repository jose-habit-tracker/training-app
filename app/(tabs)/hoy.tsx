import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getColors, SessionColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { WEEKLY_STRUCTURE, SESSION_LABELS } from '../../constants/trainingPlan';
import { DayPlan, ExerciseTemplate } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToday } from '../../hooks/useTraining';

export default function HoyScreen() {
  const colors = getColors(useColorScheme());
  const { plan: todayPlan, weekNumber, dayKey, loggedSession, loadingLog } = useToday();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [sessionDone, setSessionDone] = useState(false);

  useEffect(() => {
    if (loggedSession) setSessionDone(true);
  }, [loggedSession]);

  function toggleExercise(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleFinishSession() {
    if (!todayPlan) return;
    router.push(`/log/${dayKey}`);
  }

  if (!todayPlan) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.empty}>
          <Text style={[s.emptyText, { color: colors.text3 }]}>Cargando plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const accentColor = SessionColors[todayPlan.sessionType] ?? colors.accent;
  const totalEx = todayPlan.exercises?.length ?? 0;
  const progress = totalEx > 0 ? completed.size / totalEx : 0;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header card ── */}
        <Card flush style={[s.headerCard, { borderLeftColor: accentColor }]}>
          <View style={s.headerTop}>
            <View style={s.headerLeft}>
              <Text style={[s.dayLabel, { color: colors.text3 }]}>
                {todayPlan.dayName.toUpperCase()}
              </Text>
              <Text style={[s.sessionTitle, { color: colors.text }]}>
                {todayPlan.title}
              </Text>
            </View>
            <View style={[s.typeBadge, { backgroundColor: accentColor + '22' }]}>
              <Text style={[s.typeLabel, { color: accentColor }]}>
                {SESSION_LABELS[todayPlan.sessionType]}
              </Text>
            </View>
          </View>

          <Text style={[s.description, { color: colors.text2 }]}>
            {todayPlan.description}
          </Text>

          <View style={s.metaRow}>
            <MetaStat value={`${todayPlan.duration}`} label="minutos" color={colors.text} />
            {totalEx > 0 && (
              <MetaStat value={`${totalEx}`} label="ejercicios" color={colors.text} />
            )}
            <MetaStat
              value={`${Math.round(progress * 100)}%`}
              label="completado"
              color={accentColor}
            />
          </View>

          <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                s.progressFill,
                { width: `${progress * 100}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
        </Card>

        {/* ── Warmup ── */}
        {todayPlan.warmup && (
          <Section title="Calentamiento" colors={colors}>
            <Text style={[s.sectionBody, { color: colors.text2, backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
              {todayPlan.warmup}
            </Text>
          </Section>
        )}

        {/* ── Exercises ── */}
        {todayPlan.exercises && todayPlan.exercises.length > 0 && (
          <Section title="Ejercicios" colors={colors}>
            {todayPlan.exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                done={completed.has(ex.id)}
                accentColor={accentColor}
                colors={colors}
                onToggle={() => toggleExercise(ex.id)}
              />
            ))}
          </Section>
        )}

        {/* ── Cooldown ── */}
        {todayPlan.cooldown && (
          <Section title="Enfriamiento" colors={colors}>
            <Text style={[s.sectionBody, { color: colors.text2, backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
              {todayPlan.cooldown}
            </Text>
          </Section>
        )}

        {/* ── Coach notes ── */}
        {todayPlan.notes && (
          <View style={[s.notesCard, { borderColor: accentColor + '44', backgroundColor: colors.glassBg }]}>
            <Text style={[s.notesTitle, { color: colors.text3 }]}>Notas del coach</Text>
            <Text style={[s.notesBody, { color: colors.text2 }]}>{todayPlan.notes}</Text>
          </View>
        )}

        {/* ── Week badge ── */}
        <View style={[s.weekRow, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
          <Text style={[s.weekText, { color: colors.text3 }]}>Semana {weekNumber} · Fase Base</Text>
        </View>

        {/* ── Finish / log button ── */}
        {sessionDone ? (
          <View style={[s.doneCard, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
            <Text style={[s.doneTitle, { color: colors.accent }]}>✓ Sesión registrada</Text>
            {loggedSession?.ai_feedback && (
              <Text style={[s.doneFeedback, { color: colors.text2 }]}>{loggedSession.ai_feedback}</Text>
            )}
          </View>
        ) : (
          <Button
            label="Registrar sesión y pedir feedback"
            onPress={handleFinishSession}
            fullWidth
            style={[s.finishBtn, { backgroundColor: colors.text }]}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaStat({ value, label, color }: { value: string; label: string; color: string }) {
  const colors = getColors(useColorScheme());
  return (
    <View style={s.metaItem}>
      <Text style={[s.metaValue, { color }]}>{value}</Text>
      <Text style={[s.metaLabel, { color: colors.text3 }]}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: colors.text3 }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function ExerciseCard({
  exercise,
  done,
  accentColor,
  colors,
  onToggle,
}: {
  exercise: ExerciseTemplate;
  done: boolean;
  accentColor: string;
  colors: ReturnType<typeof getColors>;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        s.exCard,
        {
          backgroundColor: colors.glassBg,
          borderColor: done ? colors.border : colors.glassBorder,
          opacity: done ? 0.62 : 1,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      {/* Checkbox */}
      <View
        style={[
          s.checkbox,
          {
            borderColor: done ? accentColor : 'rgba(142,142,147,0.35)',
            backgroundColor: done ? accentColor : 'transparent',
          },
        ]}
      >
        {done && <Text style={s.checkmark}>✓</Text>}
      </View>

      <View style={s.exInfo}>
        <Text
          style={[
            s.exName,
            {
              color: colors.text,
              textDecorationLine: done ? 'line-through' : 'none',
            },
          ]}
        >
          {exercise.name}
        </Text>

        <View style={s.exMeta}>
          {exercise.sets && exercise.reps && (
            <Chip label={`${exercise.sets}×${exercise.reps}`} color={colors.text3} bg={colors.border} />
          )}
          {!exercise.sets && exercise.reps && (
            <Chip label={exercise.reps} color={colors.text3} bg={colors.border} />
          )}
          {exercise.distance && (
            <Chip label={exercise.distance} color={colors.text3} bg={colors.border} />
          )}
          {exercise.duration && (
            <Chip label={exercise.duration} color={colors.text3} bg={colors.border} />
          )}
          {exercise.load && (
            <Chip label={exercise.load} color={accentColor} bg={accentColor + '18'} />
          )}
          {exercise.rest && (
            <Chip label={`Rest: ${exercise.rest}`} color={colors.text3} bg={colors.border} />
          )}
        </View>

        {exercise.notes && (
          <Text style={[s.exNotes, { color: colors.text3 }]}>{exercise.notes}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.body },

  // Header card
  headerCard: {
    borderLeftWidth: 4,
    marginHorizontal: 0,
    marginTop: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.gapMd,
  },
  headerLeft: { flex: 1 },
  dayLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
    letterSpacing: Spacing.gapXxs / 2,
    marginBottom: Spacing.gapXxs,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: FontWeight.black,
    letterSpacing: -0.3,
  },
  typeBadge: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs,
    borderRadius: Radius.pill,
  },
  typeLabel: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  description: { fontSize: FontSize.md, lineHeight: 20, marginBottom: Spacing.lg },
  metaRow: { flexDirection: 'row', gap: Spacing.xxl, marginBottom: Spacing.base },
  metaItem: { alignItems: 'center' },
  metaValue: { fontSize: 20, fontWeight: FontWeight.black },
  metaLabel: { fontSize: FontSize.sm, marginTop: 2 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  // Sections
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.65,
    marginBottom: Spacing.gapMd,
  },
  sectionBody: {
    fontSize: FontSize.md,
    lineHeight: 20,
    padding: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  // Exercise card
  exCard: {
    borderRadius: Radius.md,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    marginBottom: Spacing.gapSm,
    borderWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.black },
  exInfo: { flex: 1 },
  exName: { fontSize: FontSize.body, fontWeight: FontWeight.label, marginBottom: Spacing.gapXxs },
  exMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm },
  exNotes: { fontSize: FontSize.base, marginTop: Spacing.gapXs, lineHeight: 16, fontStyle: 'italic' },

  // Chips
  chip: { paddingHorizontal: Spacing.gapSm, paddingVertical: 3, borderRadius: Spacing.gapXs },
  chipText: { fontSize: FontSize.base },

  // Coach notes
  notesCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  notesTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.5,
    marginBottom: Spacing.gapXs,
  },
  notesBody: { fontSize: FontSize.md, lineHeight: 18 },

  finishBtn: { marginTop: Spacing.gapSm },
  weekRow: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs,
    alignSelf: 'center',
    marginTop: Spacing.gapSm,
  },
  weekText: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  doneCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.cardPadding,
    marginTop: Spacing.gapSm,
    gap: Spacing.gapSm,
  },
  doneTitle: { fontSize: FontSize.body, fontWeight: FontWeight.black },
  doneFeedback: { fontSize: FontSize.md, lineHeight: 20 },
});

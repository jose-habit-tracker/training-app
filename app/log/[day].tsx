import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { SessionColors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { ExerciseTemplate } from '../../types';
import { supabase } from '../../lib/supabase';
import { askGroq } from '../../lib/groq';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { getCurrentWeek } from '../../hooks/useTraining';
import { usePlan } from '../../lib/PlanContext';

// ─── System prompt builder ────────────────────────────────────────────────────
function buildFeedbackPrompt(
  dayName: string,
  sessionTitle: string,
  sessionType: string,
  weekNumber: number,
  completedIds: Set<string>,
  exercises: ExerciseTemplate[],
  rpe: number,
  fatigue: number,
  notes: string,
): string {
  const completedList = exercises
    .filter((e) => completedIds.has(e.id))
    .map((e) => `  • ${e.name}${e.sets && e.reps ? ` (${e.sets}×${e.reps})` : ''}${e.load ? ` @ ${e.load}` : ''}`)
    .join('\n');
  const skippedList = exercises
    .filter((e) => !completedIds.has(e.id))
    .map((e) => `  • ${e.name}`)
    .join('\n');

  return `Eres un coach de entrenamiento personal experto en running (media maratón), natación y Hyrox.
Tu atleta es un chico de 23 años que entrena 7 días a la semana.
Objetivo: media maratón en octubre 2025 + preparación Hyrox posterior.

SESIÓN REGISTRADA:
- Día: ${dayName} — ${sessionTitle}
- Tipo: ${SESSION_LABELS[sessionType] ?? sessionType}
- Semana del ciclo: ${weekNumber}
- Ejercicios completados: ${completedIds.size}/${exercises.length}
- RPE percibido: ${rpe}/10
- Nivel de fatiga: ${fatigue}/10
- Notas del atleta: "${notes.trim() || 'Sin notas'}"

EJERCICIOS COMPLETADOS:
${completedList || '  (ninguno)'}

EJERCICIOS OMITIDOS:
${skippedList || '  (ninguno)'}

Proporciona feedback específico y conciso sobre esta sesión (máximo 130 palabras).
Estructura tu respuesta en 3 partes breves:
1. Evaluación del esfuerzo (RPE + fatiga)
2. Puntos destacados o a mejorar
3. Recomendación concreta para la próxima sesión

Responde en español, tono directo y motivador.`;
}

// ─── RPE / Fatigue picker ─────────────────────────────────────────────────────
function ScalePicker({
  value,
  onChange,
  label,
  accentColor,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  accentColor: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={p.pickerBlock}>
      <View style={p.pickerHeader}>
        <Text style={[p.pickerLabel, { color: colors.text3 }]}>{label.toUpperCase()}</Text>
        <Text style={[p.pickerValue, { color: accentColor }]}>{value}/10</Text>
      </View>
      <View style={p.pickerRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = n === value;
          return (
            <TouchableOpacity
              key={n}
              style={[
                p.pickerBtn,
                {
                  backgroundColor: active ? accentColor : colors.glassBg,
                  borderColor: active ? accentColor : colors.border,
                },
              ]}
              onPress={() => onChange(n)}
              activeOpacity={0.7}
            >
              <Text style={[p.pickerBtnText, { color: active ? '#fff' : colors.text3 }]}>
                {n}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Exercise row ─────────────────────────────────────────────────────────────
function ExerciseRow({
  exercise,
  done,
  accentColor,
  colors,
  onToggle,
}: {
  exercise: ExerciseTemplate;
  done: boolean;
  accentColor: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        p.exRow,
        {
          backgroundColor: done ? accentColor + '12' : colors.glassBg,
          borderColor: done ? accentColor + '44' : colors.border,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={[p.check, { borderColor: done ? accentColor : colors.text3, backgroundColor: done ? accentColor : 'transparent' }]}>
        {done && <Text style={p.checkMark}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[p.exName, { color: colors.text, textDecorationLine: done ? 'line-through' : 'none' }]}>
          {exercise.name}
        </Text>
        <Text style={[p.exDetail, { color: colors.text3 }]}>
          {[
            exercise.sets && exercise.reps ? `${exercise.sets}×${exercise.reps}` : exercise.reps,
            exercise.distance,
            exercise.duration,
            exercise.load,
          ].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LogDayScreen() {
  const { day, done } = useLocalSearchParams<{ day: string; done?: string }>();
  const { colors } = useTheme();

  const { days } = usePlan();
  const plan = days.find((d) => d.day === day);
  const weekNumber = getCurrentWeek();

  // Pre-marca los ejercicios que ya se tildaron en la pantalla Hoy
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(done ? done.split(',').filter(Boolean) : []),
  );
  const [rpe, setRpe] = useState(7);
  const [fatigue, setFatigue] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  function toggleExercise(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Error', 'No hay sesión activa'); setSaving(false); return; }

      const today = new Date().toISOString().split('T')[0];

      const fields = {
        day_name: plan.dayName,
        week_number: weekNumber,
        session_type: plan.sessionType,
        duration_min: plan.duration,
        rpe_perceived: rpe,
        fatigue,
        notes: notes.trim() || null,
        completed_at: new Date().toISOString(),
      };

      // 1. Una sesión por día: actualiza si ya existe, si no inserta
      const { data: existing } = await supabase
        .from('training_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .maybeSingle();

      const query = existing
        ? supabase.from('training_sessions').update(fields).eq('id', existing.id)
        : supabase.from('training_sessions').insert({ user_id: user.id, session_date: today, ...fields });

      const { data: session, error: sessionErr } = await query.select().single();

      if (sessionErr || !session) {
        Alert.alert('Error guardando sesión', sessionErr?.message ?? 'Error desconocido');
        setSaving(false);
        return;
      }

      setSavedSessionId(session.id);

      // 2. Reemplaza los logs de ejercicios de esta sesión
      if (plan.exercises && plan.exercises.length > 0) {
        await supabase.from('exercise_logs').delete().eq('session_id', session.id);
        const logs = plan.exercises.map((ex) => ({
          session_id: session.id,
          exercise_id: ex.id,
          exercise_name: ex.name,
          completed: completed.has(ex.id),
        }));
        await supabase.from('exercise_logs').insert(logs);
      }

      // 3. Get AI feedback
      const systemPrompt = buildFeedbackPrompt(
        plan.dayName,
        plan.title,
        plan.sessionType,
        weekNumber,
        completed,
        plan.exercises ?? [],
        rpe,
        fatigue,
        notes,
      );

      let feedback = '';
      try {
        feedback = await askGroq([{ role: 'user', content: '¿Qué opinas de mi sesión de hoy?' }], systemPrompt);
      } catch {
        feedback = 'No se pudo obtener feedback del coach. Puedes preguntarle en el chat.';
      }

      setAiFeedback(feedback);

      // 4. Persist AI feedback in session
      if (feedback) {
        await supabase
          .from('training_sessions')
          .update({ ai_feedback: feedback })
          .eq('id', session.id);
      }
    } catch (err) {
      Alert.alert('Error inesperado', String(err));
    } finally {
      setSaving(false);
    }
  }, [plan, weekNumber, rpe, fatigue, notes, completed]);

  if (!plan) {
    return (
      <SafeAreaView style={[p.container, { backgroundColor: colors.background }]}>
        <View style={p.center}>
          <Text style={[p.emptyText, { color: colors.text3 }]}>Día no encontrado</Text>
          <Button label="Volver" onPress={() => router.back()} variant="ghost" style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const accentColor = SessionColors[plan.sessionType] ?? colors.accent;
  const totalEx = plan.exercises?.length ?? 0;

  return (
    <SafeAreaView style={[p.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Header ── */}
        <View style={[p.header, { borderLeftColor: accentColor, backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
          <Text style={[p.dayLabel, { color: colors.text3 }]}>{plan.dayName.toUpperCase()} · SEM {weekNumber}</Text>
          <Text style={[p.sessionTitle, { color: colors.text }]}>{plan.title}</Text>
          <View style={[p.typePill, { backgroundColor: accentColor + '20' }]}>
            <Text style={[p.typeText, { color: accentColor }]}>{SESSION_LABELS[plan.sessionType]}</Text>
          </View>
        </View>

        {/* ── Exercises ── */}
        {plan.exercises && plan.exercises.length > 0 && (
          <View style={p.section}>
            <View style={p.sectionHeader}>
              <Text style={[p.sectionTitle, { color: colors.text3 }]}>EJERCICIOS</Text>
              <Text style={[p.sectionCount, { color: accentColor }]}>{completed.size}/{totalEx}</Text>
            </View>
            {plan.exercises.map((ex) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                done={completed.has(ex.id)}
                accentColor={accentColor}
                colors={colors}
                onToggle={() => toggleExercise(ex.id)}
              />
            ))}
          </View>
        )}

        {/* ── RPE + Fatigue ── */}
        {!savedSessionId && (
          <View style={[p.scalesCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <ScalePicker value={rpe} onChange={setRpe} label="RPE — Esfuerzo percibido" accentColor={accentColor} colors={colors} />
            <View style={[p.scaleDivider, { backgroundColor: colors.border }]} />
            <ScalePicker value={fatigue} onChange={setFatigue} label="Fatiga acumulada" accentColor={colors.orange} colors={colors} />
          </View>
        )}

        {/* ── Notes ── */}
        {!savedSessionId && (
          <Input
            label="Notas (opcional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="¿Cómo te has sentido? ¿Algo destacable?"
            containerStyle={p.notesInput}
          />
        )}

        {/* ── Save button ── */}
        {!savedSessionId && (
          <Button
            label={saving ? 'Guardando...' : 'Guardar sesión y pedir feedback'}
            onPress={handleSave}
            disabled={saving}
            fullWidth
            style={[p.saveBtn, { backgroundColor: accentColor }]}
          />
        )}

        {/* ── AI Feedback ── */}
        {saving && !aiFeedback && (
          <View style={p.loadingFeedback}>
            <ActivityIndicator color={accentColor} />
            <Text style={[p.loadingText, { color: colors.text3 }]}>Tu coach está analizando la sesión...</Text>
          </View>
        )}

        {aiFeedback && (
          <View style={[p.feedbackCard, { backgroundColor: accentColor + '12', borderColor: accentColor + '33' }]}>
            <Text style={[p.feedbackTitle, { color: accentColor }]}>Feedback del coach</Text>
            <Text style={[p.feedbackBody, { color: colors.text }]}>{aiFeedback}</Text>
            <Button
              label="Volver al inicio"
              onPress={() => router.replace('/(tabs)/hoy')}
              variant="secondary"
              fullWidth
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const p = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.body },

  header: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: Spacing.cardPadding,
  },
  dayLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65, marginBottom: 4 },
  sessionTitle: { fontSize: 22, fontWeight: FontWeight.black, letterSpacing: -0.3, marginBottom: Spacing.gapSm },
  typePill: { alignSelf: 'flex-start', paddingHorizontal: Spacing.gapMd, paddingVertical: 4, borderRadius: Radius.pill },
  typeText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },

  section: { gap: Spacing.gapSm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  sectionCount: { fontSize: FontSize.md, fontWeight: FontWeight.black },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.black },
  exName: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  exDetail: { fontSize: FontSize.base, marginTop: 2 },

  scalesCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.cardPadding,
    gap: Spacing.lg,
  },
  pickerBlock: { gap: Spacing.gapSm },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  pickerValue: { fontSize: FontSize.xl, fontWeight: FontWeight.black },
  pickerRow: { flexDirection: 'row', gap: Spacing.gapXs },
  pickerBtn: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  pickerBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  scaleDivider: { height: 1 },

  notesInput: { /* gap is handled by ScrollView gap */ },
  saveBtn: { marginTop: 0 },

  loadingFeedback: { flexDirection: 'row', alignItems: 'center', gap: Spacing.gapMd, justifyContent: 'center', paddingVertical: Spacing.lg },
  loadingText: { fontSize: FontSize.md },

  feedbackCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.cardPadding,
  },
  feedbackTitle: { fontSize: FontSize.body, fontWeight: FontWeight.black, marginBottom: Spacing.gapMd },
  feedbackBody: { fontSize: FontSize.md, lineHeight: 22 },
});

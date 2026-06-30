import React, { useState, useCallback } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { getColors, SessionColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { DayPlan, ExerciseTemplate, SessionType } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { usePlan } from '../../lib/PlanContext';

const SESSION_TYPES = Object.keys(SESSION_LABELS) as SessionType[];

export default function EditDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const colors = getColors(useColorScheme());
  const { days, save } = usePlan();

  const original = days.find((d) => d.day === day);
  const [form, setForm] = useState<DayPlan | null>(original ? { ...original, exercises: [...(original.exercises ?? [])] } : null);
  const [saving, setSaving] = useState(false);

  const setField = useCallback(<K extends keyof DayPlan>(key: K, value: DayPlan[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const updateExercise = useCallback((id: string, patch: Partial<ExerciseTemplate>) => {
    setForm((f) => f && {
      ...f,
      exercises: (f.exercises ?? []).map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)),
    });
  }, []);

  const addExercise = useCallback(() => {
    setForm((f) => f && {
      ...f,
      exercises: [...(f.exercises ?? []), { id: `${f.day}-${Date.now()}`, name: '' }],
    });
  }, []);

  const removeExercise = useCallback((id: string) => {
    setForm((f) => f && { ...f, exercises: (f.exercises ?? []).filter((ex) => ex.id !== id) });
  }, []);

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    // Limpia ejercicios sin nombre
    const cleaned: DayPlan = {
      ...form,
      exercises: (form.exercises ?? []).filter((ex) => ex.name.trim().length > 0),
    };
    const next = days.map((d) => (d.day === cleaned.day ? cleaned : d));
    const err = await save(next);
    setSaving(false);
    if (err) {
      Alert.alert('Error al guardar', err);
      return;
    }
    router.back();
  }, [form, days, save]);

  if (!form) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.center}>
          <Text style={[s.empty, { color: colors.text3 }]}>Día no encontrado</Text>
          <Button label="Volver" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const accent = SessionColors[form.sessionType] ?? colors.accent;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[s.dayName, { color: colors.text3 }]}>{form.dayName.toUpperCase()}</Text>

        <Input label="Título" value={form.title} onChangeText={(v) => setField('title', v)} placeholder="Nombre de la sesión" />

        {/* Tipo de sesión */}
        <View>
          <Text style={[s.label, { color: colors.text3 }]}>TIPO DE SESIÓN</Text>
          <View style={s.typeRow}>
            {SESSION_TYPES.map((t) => {
              const active = t === form.sessionType;
              const c = SessionColors[t] ?? colors.accent;
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.typeChip, { backgroundColor: active ? c : colors.glassBg, borderColor: active ? c : colors.border }]}
                  onPress={() => setField('sessionType', t)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.typeChipText, { color: active ? '#fff' : colors.text3 }]}>{SESSION_LABELS[t]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Input
          label="Duración (min)"
          value={String(form.duration ?? '')}
          onChangeText={(v) => setField('duration', Number(v.replace(/[^0-9]/g, '')) || 0)}
          keyboardType="number-pad"
          placeholder="60"
        />

        <Input label="Descripción" value={form.description} onChangeText={(v) => setField('description', v)} multiline placeholder="Breve descripción de la sesión" />
        <Input label="Calentamiento" value={form.warmup ?? ''} onChangeText={(v) => setField('warmup', v)} multiline placeholder="Opcional" />
        <Input label="Enfriamiento" value={form.cooldown ?? ''} onChangeText={(v) => setField('cooldown', v)} multiline placeholder="Opcional" />
        <Input label="Notas del coach" value={form.notes ?? ''} onChangeText={(v) => setField('notes', v)} multiline placeholder="Opcional" />

        {/* Ejercicios */}
        <View style={s.exHeader}>
          <Text style={[s.label, { color: colors.text3 }]}>EJERCICIOS ({form.exercises?.length ?? 0})</Text>
        </View>

        {(form.exercises ?? []).map((ex, i) => (
          <View key={ex.id} style={[s.exCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <View style={s.exTop}>
              <Text style={[s.exIndex, { color: accent }]}>#{i + 1}</Text>
              <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={8}>
                <Text style={[s.remove, { color: colors.danger }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>

            <Input value={ex.name} onChangeText={(v) => updateExercise(ex.id, { name: v })} placeholder="Nombre del ejercicio" />

            <View style={s.grid}>
              <View style={s.gridItem}>
                <Input label="Series" value={ex.sets != null ? String(ex.sets) : ''} onChangeText={(v) => updateExercise(ex.id, { sets: v ? Number(v.replace(/[^0-9]/g, '')) || undefined : undefined })} keyboardType="number-pad" placeholder="4" />
              </View>
              <View style={s.gridItem}>
                <Input label="Reps" value={ex.reps ?? ''} onChangeText={(v) => updateExercise(ex.id, { reps: v || undefined })} placeholder="8x400m" />
              </View>
              <View style={s.gridItem}>
                <Input label="Carga" value={ex.load ?? ''} onChangeText={(v) => updateExercise(ex.id, { load: v || undefined })} placeholder="40kg" />
              </View>
              <View style={s.gridItem}>
                <Input label="Distancia" value={ex.distance ?? ''} onChangeText={(v) => updateExercise(ex.id, { distance: v || undefined })} placeholder="200m" />
              </View>
              <View style={s.gridItem}>
                <Input label="Duración" value={ex.duration ?? ''} onChangeText={(v) => updateExercise(ex.id, { duration: v || undefined })} placeholder="15 min" />
              </View>
              <View style={s.gridItem}>
                <Input label="Descanso" value={ex.rest ?? ''} onChangeText={(v) => updateExercise(ex.id, { rest: v || undefined })} placeholder="2 min" />
              </View>
            </View>

            <Input label="Notas" value={ex.notes ?? ''} onChangeText={(v) => updateExercise(ex.id, { notes: v || undefined })} placeholder="Opcional" />
          </View>
        ))}

        <Button label="+ Añadir ejercicio" variant="secondary" fullWidth onPress={addExercise} style={s.addBtn} />

        <Button
          label={saving ? 'Guardando...' : 'Guardar cambios'}
          onPress={handleSave}
          disabled={saving}
          fullWidth
          style={[s.saveBtn, { backgroundColor: accent }]}
          textStyle={{ color: '#fff' }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.base },
  empty: { fontSize: FontSize.body },

  dayName: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65, marginBottom: Spacing.gapXs },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm },
  typeChip: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.gapXs + 2, borderRadius: Radius.pill, borderWidth: 1 },
  typeChipText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },

  exHeader: { marginTop: Spacing.gapSm },
  exCard: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.base, gap: Spacing.gapSm },
  exTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exIndex: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  remove: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm },
  gridItem: { flexBasis: '47%', flexGrow: 1 },

  addBtn: { marginTop: Spacing.gapSm },
  saveBtn: { marginTop: Spacing.gapSm },
});

// app/plan/[day].tsx — archivo completo
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { SessionColors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_DEFAULTS } from '../../constants/trainingPlan';
import { DayPlan, ExerciseTemplate, SessionType } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SportSegment } from '../../components/training/SportSegment';
import { VariantDropdown } from '../../components/training/VariantDropdown';
import { ExerciseAccordion } from '../../components/training/ExerciseAccordion';
import { EDITOR_SPORTS, editorSportOf, EditorSport } from '../../lib/training/fields';
import { sessionTotals } from '../../lib/training/summary';
import { normalizeLegacyExercises } from '../../lib/training/normalize';
import { usePlan } from '../../lib/PlanContext';
import { tapSuccess } from '../../lib/haptics';

// confirm() en web, Alert en nativo — Alert.alert no bloquea en react-native-web.
function confirmReplace(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm('Cambiar el tipo cargará su plantilla y reemplazará los ejercicios actuales. ¿Continuar?')) onConfirm();
    return;
  }
  Alert.alert('Cambiar tipo de sesión', 'Se cargará la plantilla del nuevo tipo y se reemplazarán los ejercicios actuales.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cambiar', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function EditDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { colors } = useTheme();
  const { days, save } = usePlan();

  const original = days.find((d) => d.day === day);
  const [form, setForm] = useState<DayPlan | null>(
    original ? { ...original, exercises: normalizeLegacyExercises([...(original.exercises ?? [])]) } : null,
  );
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof DayPlan>(key: K, value: DayPlan[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const applyType = useCallback((type: SessionType) => {
    setForm((f) => {
      if (!f || f.sessionType === type) return f;
      const def = SESSION_DEFAULTS[type];
      return {
        ...f, sessionType: type, title: def.title, duration: def.duration,
        description: def.description, warmup: def.warmup, cooldown: def.cooldown, notes: def.notes,
        exercises: normalizeLegacyExercises(def.exercises.map((ex, i) => ({ ...ex, id: `${f.day}-${Date.now()}-${i}` }))),
      };
    });
    setExpandedId(null);
  }, []);

  const requestType = useCallback((type: SessionType) => {
    if (!form || form.sessionType === type) return;
    const hasExercises = (form.exercises ?? []).length > 0;
    if (hasExercises) confirmReplace(() => applyType(type));
    else applyType(type);
  }, [form, applyType]);

  const changeSport = useCallback((sportKey: EditorSport) => {
    const def = EDITOR_SPORTS.find((sp) => sp.key === sportKey);
    if (def) requestType(def.types[0]);
  }, [requestType]);

  const updateExercise = useCallback((id: string, patch: Partial<ExerciseTemplate>) => {
    setForm((f) => f && ({
      ...f,
      exercises: (f.exercises ?? []).map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)),
    }));
  }, []);

  const addExercise = useCallback(() => {
    setForm((f) => {
      if (!f) return f;
      const newId = `${f.day}-${Date.now()}-${f.exercises?.length ?? 0}`;
      setExpandedId(newId);
      return { ...f, exercises: [...(f.exercises ?? []), { id: newId, name: '' }] };
    });
  }, []);

  const removeExercise = useCallback((id: string) => {
    setForm((f) => f && ({ ...f, exercises: (f.exercises ?? []).filter((ex) => ex.id !== id) }));
  }, []);

  const moveExercise = useCallback((id: string, dir: -1 | 1) => {
    setForm((f) => {
      if (!f) return f;
      const list = [...(f.exercises ?? [])];
      const i = list.findIndex((ex) => ex.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return f;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...f, exercises: list };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    const cleaned: DayPlan = {
      ...form,
      exercises: (form.exercises ?? []).filter((ex) => ex.name.trim().length > 0),
    };
    const next = days.map((d) => (d.day === cleaned.day ? cleaned : d));
    const err = await save(next);
    setSaving(false);
    if (err) { Alert.alert('Error al guardar', err); return; }
    tapSuccess();
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

  const sport = editorSportOf(form.sessionType);
  const sportDef = EDITOR_SPORTS.find((sp) => sp.key === sport);
  const accent = SessionColors[form.sessionType] ?? colors.accent;
  const totals = sessionTotals(form.exercises ?? [], sport);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[s.dayName, { color: colors.text3 }]}>{form.dayName.toUpperCase()}</Text>

        <Input label="Título" value={form.title} onChangeText={(v) => setField('title', v)} placeholder="Nombre de la sesión" />

        <View>
          <Text style={[s.label, { color: colors.text3 }]}>DEPORTE</Text>
          <SportSegment sport={sport} onChange={changeSport} />
        </View>

        <VariantDropdown options={sportDef?.types ?? []} value={form.sessionType} onChange={requestType} />

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

        <View style={s.exHeader}>
          <Text style={[s.label, { color: colors.text3 }]}>
            {sport === 'swim' || sport === 'run' ? 'BLOQUES' : 'EJERCICIOS'} ({form.exercises?.length ?? 0})
          </Text>
          {!!totals && <Text style={[s.totals, { color: accent }]}>{totals}</Text>}
        </View>

        {(form.exercises ?? []).map((ex, i) => (
          <ExerciseAccordion
            key={ex.id}
            exercise={ex}
            index={i}
            total={form.exercises?.length ?? 0}
            sport={sport}
            accent={accent}
            expanded={expandedId === ex.id}
            onToggle={() => setExpandedId((cur) => (cur === ex.id ? null : ex.id))}
            onChange={(patch) => updateExercise(ex.id, patch)}
            onRemove={() => removeExercise(ex.id)}
            onMove={(dir) => moveExercise(ex.id, dir)}
          />
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
  exHeader: { marginTop: Spacing.gapSm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totals: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  addBtn: { marginTop: Spacing.gapSm },
  saveBtn: { marginTop: Spacing.gapSm },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Input } from '../ui/Input';
import type { ExerciseTemplate, GymExerciseMetric } from '../../types';

interface GymFieldsProps {
  exercises: ExerciseTemplate[];         // ejercicios del plan del día
  completedIds: Set<string>;             // los marcados como hechos
  values: GymExerciseMetric[];           // metrics.ejercicios actual
  onChange: (v: GymExerciseMetric[]) => void;
}

export function GymFields({ exercises, completedIds, values, onChange }: GymFieldsProps) {
  const { colors } = useTheme();
  const done = exercises.filter((e) => completedIds.has(e.id));
  if (done.length === 0) return null;

  function kgFor(name: string): string {
    return values.find((v) => v.nombre === name)?.kg?.toString() ?? '';
  }

  function setKg(ex: ExerciseTemplate, raw: string) {
    const n = raw === '' ? undefined : Number(raw.replace(',', '.'));
    const kg = n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;
    const rest = values.filter((v) => v.nombre !== ex.name);
    const entry: GymExerciseMetric = {
      nombre: ex.name,
      series: ex.sets ?? 1,
      reps: ex.reps ?? '-',
      ...(kg !== undefined ? { kg } : {}),
    };
    onChange([...rest, entry]);
  }

  return (
    <View style={s.block}>
      <Text style={[s.label, { color: colors.text3 }]}>CARGAS REALES (KG)</Text>
      {done.map((ex) => (
        <View key={ex.id} style={s.row}>
          <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
          <Input
            value={kgFor(ex.name)}
            onChangeText={(v) => setKg(ex, v)}
            keyboardType="decimal-pad"
            placeholder={ex.load ?? 'kg'}
            containerStyle={s.kg}
          />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapSm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.gapMd },
  name: { flex: 1, fontSize: FontSize.md },
  kg: { width: 90 },
});

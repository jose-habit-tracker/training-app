import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Input } from '../ui/Input';
import type { SessionMetrics, SwimSet } from '../../types';

interface SwimFieldsProps {
  metrics: SessionMetrics;
  onChange: (m: SessionMetrics) => void;
}

export function SwimFields({ metrics, onChange }: SwimFieldsProps) {
  const { colors } = useTheme();
  const sets = metrics.series ?? [];

  function setMetros(raw: string) {
    const n = raw === '' ? undefined : Number(raw);
    onChange({ ...metrics, metros: n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined });
  }

  function updateSet(i: number, patch: Partial<SwimSet>) {
    const next = sets.map((st, idx) => (idx === i ? { ...st, ...patch } : st));
    onChange({ ...metrics, series: next });
  }

  function addSet() {
    onChange({ ...metrics, series: [...sets, { reps: 4, distancia_m: 100 }] });
  }

  function removeSet(i: number) {
    const next = sets.filter((_, idx) => idx !== i);
    onChange({ ...metrics, series: next.length ? next : undefined });
  }

  return (
    <View style={s.block}>
      <Input
        label="Metros totales"
        value={metrics.metros?.toString() ?? ''}
        onChangeText={setMetros}
        keyboardType="number-pad"
        placeholder="2000"
      />
      <Text style={[s.label, { color: colors.text3 }]}>SERIES</Text>
      {sets.map((st, i) => (
        <View key={i} style={s.setRow}>
          <Input
            value={st.reps.toString()}
            onChangeText={(v) => updateSet(i, { reps: Number(v) || 1 })}
            keyboardType="number-pad"
            containerStyle={s.tiny}
          />
          <Text style={[s.x, { color: colors.text3 }]}>×</Text>
          <Input
            value={st.distancia_m.toString()}
            onChangeText={(v) => updateSet(i, { distancia_m: Number(v) || 25 })}
            keyboardType="number-pad"
            containerStyle={s.tiny}
          />
          <Text style={[s.x, { color: colors.text3 }]}>m</Text>
          <Input
            value={st.descripcion ?? ''}
            onChangeText={(v) => updateSet(i, { descripcion: v || undefined })}
            placeholder="técnica, pull…"
            containerStyle={s.desc}
          />
          <TouchableOpacity onPress={() => removeSet(i)} hitSlop={8}>
            <Text style={[s.remove, { color: colors.danger }]}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={[s.addBtn, { borderColor: colors.border }]}
        onPress={addSet}
        activeOpacity={0.75}
      >
        <Text style={[s.addText, { color: colors.accent }]}>+ Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapMd },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.gapSm },
  tiny: { width: 58 },
  desc: { flex: 1 },
  x: { fontSize: FontSize.md },
  remove: { fontSize: FontSize.body, paddingHorizontal: Spacing.gapXs },
  addBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.gapSm,
    alignItems: 'center',
  },
  addText: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
});

import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { tapLight } from '../../lib/haptics';

interface StepperProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
}

export function Stepper({ label, value, onChange, min = 1, max = 99 }: StepperProps) {
  const { colors } = useTheme();

  const bump = (delta: number) => {
    tapLight();
    // Con valor vacío parte de min - delta para que el primer toque aterrice en min.
    const next = Math.min(max, Math.max(min, (value ?? min - delta) + delta));
    onChange(next);
  };

  return (
    <View style={s.container}>
      <Text style={[s.label, { color: colors.text3 }]}>{label.toUpperCase()}</Text>
      <View style={[s.row, { backgroundColor: colors.glassBg, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.card }]}
          onPress={() => bump(-1)}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Restar"
        >
          <Text style={[s.btnText, { color: colors.accent }]}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={[s.value, { color: colors.text }]}
          value={value != null ? String(value) : ''}
          onChangeText={(v) => {
            const n = Number(v.replace(/[^0-9]/g, ''));
            onChange(v === '' ? undefined : Math.min(max, Math.max(min, n || min)));
          }}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.text3}
        />
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.card }]}
          onPress={() => bump(1)}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Sumar"
        >
          <Text style={[s.btnText, { color: colors.accent }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.3, marginBottom: Spacing.gapXs },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.gapXs, minHeight: 42 },
  btn: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: FontSize.lg, fontWeight: FontWeight.black, lineHeight: 20 },
  value: { flex: 1, textAlign: 'center', fontSize: FontSize.md, fontWeight: FontWeight.heavy, paddingVertical: 0 },
});

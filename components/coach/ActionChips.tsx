import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface ActionChipsProps {
  onRecord: () => void;
  onManualLog: () => void;
  onViewPlan: () => void;
  micSupported: boolean;
}

export function ActionChips({ onRecord, onManualLog, onViewPlan, micSupported }: ActionChipsProps) {
  const { colors } = useTheme();
  const chips = [
    ...(micSupported ? [{ label: '🎙 Contar por voz', onPress: onRecord }] : []),
    { label: '✍️ Registrar', onPress: onManualLog },
    { label: '📋 Ver plan de hoy', onPress: onViewPlan },
  ];
  return (
    <View style={s.row}>
      {chips.map((c) => (
        <TouchableOpacity
          key={c.label}
          style={[s.chip, { backgroundColor: colors.accent + '16', borderColor: colors.accent + '44' }]}
          onPress={c.onPress}
          activeOpacity={0.75}
        >
          <Text style={[s.chipText, { color: colors.accent }]}>{c.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm, marginBottom: Spacing.base },
  chip: {
    paddingHorizontal: Spacing.gapMd + 2,
    paddingVertical: Spacing.gapXs + 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});

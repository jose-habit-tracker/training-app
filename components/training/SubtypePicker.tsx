import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SUBTYPE_LABELS, SUBTYPES_BY_GROUP } from '../../constants/trainingPlan';
import type { SessionSubtype, SportGroup } from '../../types';

interface SubtypePickerProps {
  group: SportGroup;
  value: SessionSubtype | null;
  onChange: (v: SessionSubtype) => void;
  accentColor: string;
}

export function SubtypePicker({ group, value, onChange, accentColor }: SubtypePickerProps) {
  const { colors } = useTheme();
  const options = SUBTYPES_BY_GROUP[group];
  if (options.length <= 1) return null;

  return (
    <View style={s.block}>
      <Text style={[s.label, { color: colors.text3 }]}>TIPO DE SESIÓN</Text>
      <View style={s.row}>
        {options.map((sub) => {
          const active = sub === value;
          return (
            <TouchableOpacity
              key={sub}
              style={[
                s.chip,
                {
                  backgroundColor: active ? accentColor : colors.glassBg,
                  borderColor: active ? accentColor : colors.border,
                },
              ]}
              onPress={() => onChange(sub)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, { color: active ? '#fff' : colors.text3 }]}>
                {SUBTYPE_LABELS[sub]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapSm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm },
  chip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});

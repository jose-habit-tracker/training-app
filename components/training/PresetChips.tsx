import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { tapLight } from '../../lib/haptics';

interface PresetChipsProps {
  presets: string[];
  value: string | undefined;
  onSelect: (v: string) => void;
  accent: string;
}

export function PresetChips({ presets, value, onSelect, accent }: PresetChipsProps) {
  const { colors } = useTheme();
  return (
    <View style={s.row}>
      {presets.map((p) => {
        const active = value === p;
        return (
          <TouchableOpacity
            key={p}
            style={[s.chip, { backgroundColor: active ? accent : colors.glassBg, borderColor: active ? accent : colors.border }]}
            onPress={() => { tapLight(); onSelect(p); }}
            activeOpacity={0.75}
          >
            <Text style={[s.text, { color: active ? '#fff' : colors.text3 }]}>{p}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapXs, marginTop: Spacing.gapXs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1 },
  text: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { EDITOR_SPORTS, EditorSport } from '../../lib/training/fields';
import { SessionColors } from '../../constants/colors';
import { tapLight } from '../../lib/haptics';

interface SportSegmentProps {
  sport: EditorSport;
  onChange: (sport: EditorSport) => void;
}

export function SportSegment({ sport, onChange }: SportSegmentProps) {
  const { colors } = useTheme();
  return (
    <View style={[s.track, { backgroundColor: colors.glassBg, borderColor: colors.border }]}>
      {EDITOR_SPORTS.map((def) => {
        const active = def.key === sport;
        const accent = SessionColors[def.types[0]] ?? colors.accent;
        return (
          <TouchableOpacity
            key={def.key}
            style={[s.segment, active && { backgroundColor: accent }]}
            onPress={() => { if (!active) { tapLight(); onChange(def.key); } }}
            activeOpacity={0.8}
          >
            <Text style={s.icon}>{def.icon}</Text>
            <Text style={[s.label, { color: active ? '#fff' : colors.text3 }]}>{def.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: 3, gap: 2 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.s, borderRadius: Radius.sm, gap: 1 },
  icon: { fontSize: FontSize.md },
  label: { fontSize: 10, fontWeight: FontWeight.heavy },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface Props {
  raceDays: number | null;
  raceTitle: string | null;
  streak: number;
  avgRpe: number | null;
}

export function StatTiles({ raceDays, raceTitle, streak, avgRpe }: Props) {
  const { colors } = useTheme();
  const tile = [s.tile, { backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <View style={s.row}>
      <View style={tile}>
        <Text style={[s.value, { color: colors.teal }]}>
          {raceDays == null ? '—' : `${raceDays} d`}
        </Text>
        <Text style={[s.label, { color: colors.text3 }]} numberOfLines={1}>
          {raceTitle ?? 'Sin carrera'}
        </Text>
      </View>
      <View style={tile}>
        <Text style={[s.value, { color: colors.orange }]}>🔥 {streak}</Text>
        <Text style={[s.label, { color: colors.text3 }]} numberOfLines={1}>Racha de días</Text>
      </View>
      <View style={tile}>
        <Text style={[s.value, { color: colors.text }]}>
          {avgRpe == null ? '—' : avgRpe.toFixed(1)}
        </Text>
        <Text style={[s.label, { color: colors.text3 }]} numberOfLines={1}>RPE medio sem.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.gapMd },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, letterSpacing: -0.3 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 2 },
});

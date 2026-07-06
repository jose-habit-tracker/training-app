import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';
import { Input } from '../ui/Input';
import type { SessionMetrics } from '../../types';

interface RunningFieldsProps {
  metrics: SessionMetrics;
  durationMin: number;
  onChange: (m: SessionMetrics) => void;
}

// Ritmo mm:ss/km calculado de duración+distancia; editable a mano después.
export function computePace(durationMin: number, distanciaKm: number): string {
  if (!durationMin || !distanciaKm) return '';
  const secPerKm = (durationMin * 60) / distanciaKm;
  const mm = Math.floor(secPerKm / 60);
  const ss = Math.round(secPerKm % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export function RunningFields({ metrics, durationMin, onChange }: RunningFieldsProps) {
  const { colors } = useTheme();

  function setNum(key: 'distancia_km' | 'fc_media' | 'fc_max', raw: string) {
    const v = raw.replace(',', '.');
    const n = v === '' ? undefined : Number(v);
    const next = { ...metrics, [key]: n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined };
    if (key === 'distancia_km' && next.distancia_km) {
      next.ritmo_min_km = computePace(durationMin, next.distancia_km);
    }
    onChange(next);
  }

  return (
    <View style={s.block}>
      <View style={s.row}>
        <Input
          label="Distancia (km)"
          value={metrics.distancia_km?.toString() ?? ''}
          onChangeText={(v) => setNum('distancia_km', v)}
          keyboardType="decimal-pad"
          placeholder="12.5"
          containerStyle={s.half}
        />
        <Input
          label="Ritmo (min/km)"
          value={metrics.ritmo_min_km ?? ''}
          onChangeText={(v) => onChange({ ...metrics, ritmo_min_km: v || undefined })}
          placeholder="4:35"
          containerStyle={s.half}
        />
      </View>
      <View style={s.row}>
        <Input
          label="FC media"
          value={metrics.fc_media?.toString() ?? ''}
          onChangeText={(v) => setNum('fc_media', v)}
          keyboardType="number-pad"
          placeholder="152"
          containerStyle={s.half}
        />
        <Input
          label="FC máx"
          value={metrics.fc_max?.toString() ?? ''}
          onChangeText={(v) => setNum('fc_max', v)}
          keyboardType="number-pad"
          placeholder="176"
          containerStyle={s.half}
        />
      </View>
      {!!metrics.distancia_km && !!metrics.ritmo_min_km && (
        <Text style={[s.hint, { color: colors.text3 }]}>
          Ritmo autocalculado con la duración — edítalo si tu reloj dice otra cosa.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: Spacing.gapMd },
  row: { flexDirection: 'row', gap: Spacing.gapMd },
  half: { flex: 1 },
  hint: { fontSize: FontSize.sm, fontStyle: 'italic' },
});

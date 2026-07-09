// components/training/HeroCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { SessionColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { deriveBlocks } from '../../lib/training/blocks';
import { DayPlan, SessionType } from '../../types';

const SPORT_LABEL: Record<SessionType, string> = {
  running_easy: 'Running',
  running_threshold: 'Running',
  running_long: 'Running',
  running_intervals: 'Running',
  swimming: 'Natación',
  gym_strength: 'Gimnasio',
  gym_hyrox: 'Hyrox',
  hyrox_simulation: 'Hyrox',
  rest: 'Descanso',
  active_recovery: 'Recuperación',
};

interface Props {
  plan: DayPlan | null;
  onStart: () => void;
  onLog: () => void;
  onEditPlan: () => void;
}

export function HeroCard({ plan, onStart, onLog, onEditPlan }: Props) {
  const { colors } = useTheme();

  if (!plan) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.title, { color: colors.text }]}>Sin sesión planificada</Text>
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: colors.accent }]}
            onPress={onEditPlan}
            activeOpacity={0.8}
          >
            <Text style={s.btnPrimaryText}>Ver plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tint = SessionColors[plan.sessionType] ?? colors.accent;
  const isRest = plan.sessionType === 'rest';
  const blocks = deriveBlocks(plan);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: isRest ? colors.border : `${tint}59` }]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: isRest ? 0.04 : 0.1, borderRadius: Radius.card }]}
      />
      <Text style={[s.kicker, { color: isRest ? colors.text3 : tint }]}>
        {plan.dayName.toUpperCase()} · HOY
      </Text>
      <Text style={[s.title, { color: colors.text }]}>{plan.title}</Text>
      <Text style={[s.meta, { color: colors.text2 }]}>
        {plan.duration} min · {SPORT_LABEL[plan.sessionType]}
      </Text>

      {blocks.length > 0 && (
        <View style={s.blocks}>
          {blocks.map((b) => (
            <View key={b.key} style={[s.block, { borderColor: colors.border, backgroundColor: colors.glassBg }]}>
              <Text style={[s.blockLabel, { color: colors.text }]} numberOfLines={1}>{b.label}</Text>
              <Text style={[s.blockDetail, { color: colors.text3 }]} numberOfLines={2}>{b.detail}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.actions}>
        {!isRest && (
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: tint }]}
            onPress={onStart}
            activeOpacity={0.8}
          >
            <Text style={s.btnPrimaryText}>▶ Empezar sesión</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnGhost, { borderColor: colors.border, backgroundColor: colors.glassBg }]}
          onPress={onLog}
          activeOpacity={0.8}
        >
          <Text style={[s.btnGhostText, { color: colors.text }]}>Registrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.cardPadding,
    overflow: 'hidden',
  },
  kicker: {
    fontSize: FontSize.s,
    fontWeight: FontWeight.heavy,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.4,
    marginTop: Spacing.xxs,
  },
  meta: { fontSize: FontSize.base, marginTop: 2 },
  blocks: { flexDirection: 'row', gap: Spacing.gapXs, marginTop: Spacing.base },
  block: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.s,
  },
  blockLabel: { fontSize: FontSize.s, fontWeight: FontWeight.heavy },
  blockDetail: { fontSize: FontSize.xs, marginTop: 1 },
  actions: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.lg },
  btnPrimary: {
    flex: 1.4,
    borderRadius: Radius.md,
    paddingVertical: Spacing.inputPaddingV,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#ffffff', fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.inputPaddingV,
    alignItems: 'center',
  },
  btnGhostText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

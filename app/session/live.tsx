// app/session/live.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, TextStyles } from '../../constants/typography';
import { SessionColors } from '../../constants/colors';
import { usePlan } from '../../lib/PlanContext';
import { deriveBlocks } from '../../lib/training/blocks';

export default function LiveSessionScreen() {
  const { colors } = useTheme();
  const { day } = useLocalSearchParams<{ day: string }>();
  const { weeks, currentWeekIndex } = usePlan();
  const plan = (weeks[currentWeekIndex]?.days ?? []).find((d) => d.day === day) ?? null;
  const blocks = plan ? deriveBlocks(plan) : [];
  const tint = plan ? SessionColors[plan.sessionType] ?? colors.accent : colors.accent;

  // El cronómetro se deriva de timestamps: sobrevive a background/foreground
  // sin timers nativos (el intervalo solo refresca la vista).
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [blockIndex, setBlockIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const isLastBlock = blocks.length === 0 || blockIndex >= blocks.length - 1;

  const finish = () => {
    const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    router.replace({
      pathname: '/log/[day]',
      params: { day: day ?? '', prefill: JSON.stringify({ duration_min: durationMin }) },
    });
  };

  if (!plan) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={s.center}>
          <Text style={[s.emptyText, { color: colors.text3 }]}>No hay sesión planificada para hoy.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.text }]}>{plan.title}</Text>
        <Text style={[s.timer, { color: tint }]}>{mm}:{ss}</Text>

        <View style={s.blockList}>
          {blocks.map((b, i) => {
            const isDone = i < blockIndex;
            const isCurrent = i === blockIndex;
            return (
              <View
                key={b.key}
                style={[
                  s.blockRow,
                  { backgroundColor: colors.card, borderColor: isCurrent ? tint : colors.border },
                ]}
              >
                <Ionicons
                  name={isDone ? 'checkmark-circle' : isCurrent ? 'play-circle' : 'ellipse-outline'}
                  size={22}
                  color={isDone ? colors.accent : isCurrent ? tint : colors.text3}
                />
                <View style={s.blockTextWrap}>
                  <Text
                    style={[
                      s.blockLabel,
                      { color: isDone ? colors.text3 : colors.text },
                      isDone && s.strike,
                    ]}
                  >
                    {b.label}
                  </Text>
                  <Text style={[s.blockDetail, { color: colors.text3 }]} numberOfLines={2}>
                    {b.detail}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        {!isLastBlock && (
          <TouchableOpacity
            style={[s.btnGhost, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setBlockIndex((i) => i + 1)}
            activeOpacity={0.8}
          >
            <Text style={[s.btnGhostText, { color: colors.text }]}>Siguiente bloque</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: tint }]}
          onPress={finish}
          activeOpacity={0.8}
        >
          <Text style={s.btnPrimaryText}>Terminar y registrar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FontSize.md },
  scroll: { padding: Spacing.lg },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  timer: {
    ...TextStyles.timer,
    textAlign: 'center',
    marginVertical: Spacing.xxl,
    fontVariant: ['tabular-nums'],
  },
  blockList: { gap: Spacing.gapSm },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.gapMd,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
  },
  blockTextWrap: { flex: 1 },
  blockLabel: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  blockDetail: { fontSize: FontSize.base, marginTop: 1 },
  strike: { textDecorationLine: 'line-through' },
  footer: {
    flexDirection: 'row',
    gap: Spacing.gapSm,
    padding: Spacing.lg,
    paddingTop: Spacing.gapSm,
  },
  btnPrimary: {
    flex: 1.4,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#ffffff', fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  btnGhostText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

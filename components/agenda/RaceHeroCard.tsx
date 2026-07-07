// components/agenda/RaceHeroCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, TrainingPhase } from '../../types';
import { PhaseRange, phaseAt } from '../../lib/agenda/phases';
import { parseClock, paceMinKm } from '../../lib/agenda/time';

const PHASE_LABELS: Record<TrainingPhase, string> = {
  base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper', race: 'Race', hyrox_prep: 'Hyrox',
};
const PHASE_COLORS: Record<TrainingPhase, string> = {
  base: '#30d158', build: '#0a84ff', peak: '#bf5af2', taper: '#ff9f0a', race: '#ff375f', hyrox_prep: '#ff6b35',
};

interface RaceHeroCardProps {
  race: CalendarEvent;          // kind='race' con race details
  phases: PhaseRange[];
  compliance: number;           // 0-100
}

export function RaceHeroCard({ race, phases, compliance }: RaceHeroCardProps) {
  const { colors } = useTheme();
  const details = race.race!;
  const today = new Date().toISOString().split('T')[0];
  const daysLeft = Math.max(0, Math.ceil((new Date(`${race.date}T00:00:00`).getTime() - Date.now()) / 86_400_000));
  const currentPhase = phaseAt(phases, today);
  const targetSeconds = details.target_time ? parseClock(details.target_time) : null;
  const pace = targetSeconds !== null ? paceMinKm(targetSeconds, details.distance_km) : null;
  const dateLabel = new Date(`${race.date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const totalDays = phases.length
    ? (new Date(`${phases[phases.length - 1].end}T00:00:00`).getTime() - new Date(`${phases[0].start}T00:00:00`).getTime()) / 86_400_000
    : 0;

  return (
    <LinearGradient colors={['#2a0a14', '#45102a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
      <Text style={s.tag}>
        CARRERA OBJETIVO{currentPhase ? ` · FASE ${PHASE_LABELS[currentPhase].toUpperCase()}` : ''}
      </Text>
      <Text style={s.name}>{race.title}</Text>
      <Text style={s.meta}>
        {dateLabel} · {details.distance_km.toLocaleString('es-ES')} km
        {details.target_time ? ` · objetivo ${details.target_time}${pace ? ` (${pace}/km)` : ''}` : ''}
      </Text>

      <View style={s.counters}>
        <View style={s.counter}>
          <Animated.Text key={daysLeft} entering={FadeInDown.duration(300)} style={s.counterValue}>{daysLeft}</Animated.Text>
          <Text style={s.counterLabel}>DÍAS</Text>
        </View>
        <View style={s.counter}>
          <Text style={s.counterValue}>{Math.floor(daysLeft / 7)}</Text>
          <Text style={s.counterLabel}>SEMANAS</Text>
        </View>
        <View style={s.counter}>
          <Text style={s.counterValue}>{compliance}%</Text>
          <Text style={s.counterLabel}>PLAN CUMPLIDO</Text>
        </View>
      </View>

      {phases.length > 0 && totalDays > 0 && (
        <View>
          <View style={s.phaseBar}>
            {phases.map((p) => {
              const days = (new Date(`${p.end}T00:00:00`).getTime() - new Date(`${p.start}T00:00:00`).getTime()) / 86_400_000 + 1;
              const active = p.phase === currentPhase;
              return (
                <View
                  key={p.phase}
                  style={{ flex: days, backgroundColor: active ? PHASE_COLORS[p.phase] : 'rgba(255,255,255,0.14)' }}
                />
              );
            })}
          </View>
          <View style={s.phaseLabels}>
            {phases.map((p) => (
              <Text key={p.phase} style={[s.phaseLabel, p.phase === currentPhase && { color: PHASE_COLORS[p.phase] }]}>
                {PHASE_LABELS[p.phase]}
              </Text>
            ))}
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.cardPadding, gap: Spacing.gapXs },
  tag: { color: '#ff375f', fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: 1 },
  name: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.black },
  meta: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.base },
  counters: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.gapSm },
  counter: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  counterValue: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.black, fontVariant: ['tabular-nums'] },
  counterLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: FontWeight.heavy, letterSpacing: 0.5 },
  phaseBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.gapSm },
  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  phaseLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: FontWeight.heavy },
});

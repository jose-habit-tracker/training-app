// components/agenda/EventRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent } from '../../types';
import { paceMinKm, parseClock } from '../../lib/agenda/time';
import { PressableScale } from '../ui/PressableScale';

interface EventRowProps {
  event: CalendarEvent;
  onPress: () => void;
}

export function EventRow({ event, onPress }: EventRowProps) {
  const { colors } = useTheme();
  const isRace = event.kind === 'race';
  const result = event.race?.result_time;
  const daysLeft = Math.ceil((new Date(`${event.date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const resultSeconds = result ? parseClock(result) : null;
  const pace = resultSeconds !== null && event.race ? paceMinKm(resultSeconds, event.race.distance_km) : null;

  const pill = result
    ? { text: pace ? `${pace}/km` : result, bg: colors.accentSoft, color: colors.accent }
    : isRace
      ? { text: `${Math.max(0, daysLeft)} D`, bg: 'rgba(255,55,95,0.14)', color: '#ff375f' }
      : { text: 'EVENTO', bg: 'rgba(255,159,10,0.14)', color: '#ff9f0a' };

  return (
    <PressableScale style={[s.row, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]} onPress={onPress}>
      <View style={s.left}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
          {isRace ? '🏁 ' : `${event.icon ?? '📌'} `}{event.title}
        </Text>
        <Text style={[s.meta, { color: colors.text3 }]} numberOfLines={1}>
          {dateLabel}
          {event.race?.target_time && !result ? ` · objetivo ${event.race.target_time}` : ''}
          {result ? ` · ${result}` : ''}
          {event.race?.ai_analysis ? ' · análisis del coach' : ''}
        </Text>
      </View>
      <View style={[s.pill, { backgroundColor: pill.bg }]}>
        <Text style={[s.pillText, { color: pill.color }]}>{pill.text}</Text>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.gapSm },
  left: { flex: 1 },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  meta: { fontSize: FontSize.base, marginTop: 2 },
  pill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 3 },
  pillText: { fontSize: FontSize.sm, fontWeight: FontWeight.black },
});

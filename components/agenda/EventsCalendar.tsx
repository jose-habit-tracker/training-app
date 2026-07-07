// components/agenda/EventsCalendar.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent } from '../../types';
import { monthGrid, monthLabel, MonthCell } from '../../lib/agenda/month';
import { tapLight } from '../../lib/haptics';

interface EventsCalendarProps {
  events: CalendarEvent[];
  onDayPress: (iso: string, dayEvents: CalendarEvent[]) => void;
}

function eventsOn(events: CalendarEvent[], iso: string): CalendarEvent[] {
  return events.filter((e) => iso >= e.date && iso <= (e.end_date ?? e.date));
}

export function EventsCalendar({ events, onDayPress }: EventsCalendarProps) {
  const { colors } = useTheme();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const todayIso = now.toISOString().split('T')[0];

  const shift = (delta: number) => {
    tapLight();
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const grid = monthGrid(cursor.year, cursor.month);

  const renderCell = (cell: MonthCell) => {
    const dayEvents = eventsOn(events, cell.iso);
    const hasRace = dayEvents.some((e) => e.kind === 'race');
    const hasEvent = dayEvents.some((e) => e.kind === 'event');
    const isToday = cell.iso === todayIso;

    return (
      <TouchableOpacity
        key={cell.iso}
        style={[
          s.cell,
          isToday && { backgroundColor: colors.accent },
          !isToday && hasRace && s.raceCell,
          !isToday && !hasRace && hasEvent && s.eventCell,
        ]}
        onPress={() => onDayPress(cell.iso, dayEvents)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            s.cellText,
            { color: cell.inMonth ? colors.text : colors.text3 },
            isToday && { color: '#fff', fontWeight: FontWeight.black },
            !isToday && hasRace && { color: '#ff375f', fontWeight: FontWeight.black },
          ]}
        >
          {cell.day}
        </Text>
        <Text style={s.cellIcon}>
          {hasRace ? '🏁' : hasEvent ? (dayEvents.find((e) => e.kind === 'event')?.icon ?? '📌') : ' '}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.card, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>{monthLabel(cursor.year, cursor.month)}</Text>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={s.dowRow}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
          <Text key={`${d}${i}`} style={[s.dow, { color: colors.text3 }]}>{d}</Text>
        ))}
      </View>

      <Animated.View key={`${cursor.year}-${cursor.month}`} entering={FadeIn.duration(200)}>
        {grid.map((week) => (
          <View key={week[0].iso} style={s.weekRow}>{week.map(renderCell)}</View>
        ))}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xs, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.black, textTransform: 'capitalize' },
  dowRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  dow: { flex: 1, textAlign: 'center', fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: Radius.sm, margin: 1 },
  raceCell: { backgroundColor: 'rgba(255,55,95,0.14)', borderWidth: 1, borderColor: '#ff375f' },
  eventCell: { backgroundColor: 'rgba(255,159,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.45)' },
  cellText: { fontSize: FontSize.base, fontVariant: ['tabular-nums'] },
  cellIcon: { fontSize: 8, lineHeight: 10 },
});

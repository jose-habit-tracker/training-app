// components/training/WeekStrip.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { DayPlan } from '../../types';

const WEEK_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LETTER: Record<string, string> = {
  monday: 'L', tuesday: 'M', wednesday: 'X', thursday: 'J',
  friday: 'V', saturday: 'S', sunday: 'D',
};

interface Props {
  days: DayPlan[];
  doneDayKeys: Set<string>;
  todayKey: string;
  todayColor: string;
  onPressDay: () => void;
}

export function WeekStrip({ days, doneDayKeys, todayKey, todayColor, onPressDay }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[s.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {WEEK_ORDER.map((key) => {
        const done = doneDayKeys.has(key);
        const isToday = key === todayKey;
        const isRest = days.find((d) => d.day === key)?.sessionType === 'rest';
        return (
          <Pressable key={key} style={s.day} onPress={onPressDay}>
            <Text style={[s.letter, { color: isToday ? colors.text : colors.text3 }]}>
              {DAY_LETTER[key]}
            </Text>
            {done ? (
              <View style={[s.dot, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                <Text style={[s.dotText, { color: colors.accent }]}>✓</Text>
              </View>
            ) : isToday ? (
              <View style={[s.dot, { backgroundColor: todayColor, borderColor: todayColor }]}>
                <Text style={[s.dotText, { color: '#ffffff' }]}>{DAY_LETTER[key]}</Text>
              </View>
            ) : (
              <View
                style={[
                  s.dot,
                  s.pending,
                  { borderColor: colors.border, opacity: isRest ? 0.5 : 1 },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginTop: Spacing.gapLg,
  },
  day: { alignItems: 'center', gap: Spacing.gapXxs },
  letter: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy },
  dot: {
    width: 26,
    height: 26,
    borderRadius: Radius.circle,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: { borderStyle: 'dashed' },
  dotText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy },
});

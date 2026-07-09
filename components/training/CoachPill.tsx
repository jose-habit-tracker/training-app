import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { PressableScale } from '../ui/PressableScale';

interface Props {
  onPress: () => void;
}

export function CoachPill({ onPress }: Props) {
  const { colors } = useTheme();

  return (
    <PressableScale onPress={onPress} style={s.wrap} accessibilityLabel="Habla con tu coach">
      <LinearGradient
        colors={['rgba(48,209,88,0.14)', 'rgba(10,132,255,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.pill, { backgroundColor: colors.card, borderColor: `${colors.accent}59` }]}
      >
        <Text style={[s.text, { color: colors.text2 }]}>Habla con tu coach…</Text>
        <View style={[s.mic, { backgroundColor: colors.accent }]}>
          <Ionicons name="mic" size={15} color="#ffffff" />
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.gapSm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
    overflow: 'hidden',
  },
  text: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  mic: {
    width: 28,
    height: 28,
    borderRadius: Radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

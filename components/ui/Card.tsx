import React from 'react';
import {
  View,
  ViewStyle,
  StyleSheet,
  StyleProp,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (e: GestureResponderEvent) => void;
  // Visual variants
  variant?: 'default' | 'stat' | 'elevated';
  // Removes the horizontal section margin (for inline or full-width cards)
  flush?: boolean;
}

export function Card({ children, style, onPress, variant = 'default', flush = false }: CardProps) {
  const { colors, shadows, radius, spacing } = useTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: colors.glassBg,
    borderRadius: variant === 'stat' ? radius.card : radius.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: variant === 'stat' ? spacing.statCardPadding : spacing.cardPadding,
    marginTop: variant === 'stat' ? 0 : spacing.panelMarginTop,
    marginHorizontal: flush ? 0 : spacing.sectionHorizontal,
    ...shadows.card,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[baseStyle, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}

// ─── Stat card grid helpers ───────────────────────────────────────────────────

interface StatGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  style?: StyleProp<ViewStyle>;
}

export function StatGrid({ children, columns = 2, style }: StatGridProps) {
  const { spacing } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.gapMd,
          marginTop: spacing.panelMarginTop,
          marginHorizontal: spacing.sectionHorizontal,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function StatCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, shadows, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.glassBg,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          padding: spacing.statCardPadding,
          ...shadows.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

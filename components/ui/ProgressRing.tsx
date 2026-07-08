import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { FontSize, FontWeight } from '../../constants/typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  done: number;
  total: number;
  size?: number;
}

export function ProgressRing({ done, total, size = 64 }: ProgressRingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const progress = useSharedValue(0);

  // En web los animatedProps de Reanimated sobre react-native-svg pueden no
  // propagarse (el anillo se pintaría siempre lleno) → círculo estático.
  const isStatic = Platform.OS === 'web' || reduceMotion;

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        {isStatic ? (
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={colors.accent} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={circumference * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : (
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={r}
            stroke={colors.accent} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={s.center}>
        <Text style={[s.value, { color: colors.text }]}>{done}/{total}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.black, fontVariant: ['tabular-nums'] },
});

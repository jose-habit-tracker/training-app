import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const COLORS = ['#30d158', '#0a84ff', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff'];
const COUNT = 36;

function Particle({ index }: { index: number }) {
  const { width, height } = Dimensions.get('window');
  const progress = useSharedValue(0);
  const startX = (index / COUNT) * width + (index % 3) * 8;
  const drift = ((index % 7) - 3) * 30;
  const size = 6 + (index % 3) * 3;

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1400 + (index % 5) * 120, easing: Easing.out(Easing.quad) });
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + drift * progress.value },
      { translateY: -20 + (height * 0.9) * progress.value },
      { rotate: `${progress.value * (180 + index * 20)}deg` },
    ],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View
      style={[s.particle, style, { width: size, height: size * 1.6, backgroundColor: COLORS[index % COLORS.length] }]}
    />
  );
}

export function Confetti({ trigger }: { trigger: number }) {
  const reduce = useReduceMotion();
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (trigger === 0 || reduce) return;
    setBurst(trigger);
    const t = setTimeout(() => setBurst(0), 2000);
    return () => clearTimeout(t);
  }, [trigger, reduce]);

  if (burst === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: COUNT }, (_, i) => <Particle key={`${burst}-${i}`} index={i} />)}
    </View>
  );
}

const s = StyleSheet.create({
  particle: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
});

// components/ui/NextLevelSplash.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { FontWeight } from '../../constants/typography';

let shownThisLaunch = false;

// true solo la primera vez por arranque (el flag vive en memoria: cada cold
// start vuelve a mostrar el splash; cambiar de pestaña no).
export function consumeSplashSlot(): boolean {
  if (shownThisLaunch) return false;
  shownThisLaunch = true;
  return true;
}

interface Props {
  onDone: () => void;
}

export function NextLevelSplash({ onDone }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const line = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  const finish = useCallback((fast: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: fast ? 200 : 600,
      useNativeDriver: true,
    }).start(() => onDone());
  }, [opacity, onDone]);

  useEffect(() => {
    const fadeIn = reduceMotion ? 200 : 400;
    const hold = reduceMotion ? 1100 : 2500;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: fadeIn, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: reduceMotion ? 0 : 500, useNativeDriver: true }),
      Animated.timing(line, { toValue: 1, duration: reduceMotion ? 0 : 900, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => finish(false), fadeIn + hold);
    return () => clearTimeout(t);
  }, [reduceMotion, opacity, scale, line, finish]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.overlay, { opacity }]}>
      <Pressable style={s.press} onPress={() => finish(true)} accessibilityLabel="Saltar introducción">
        <Animated.View style={[s.inner, { transform: [{ scale }] }]}>
          <Text style={[s.phrase, { textShadowColor: colors.accent }]}>
            GO TO THE{'\n'}NEXT LEVEL
          </Text>
          <Animated.View style={[s.lineWrap, { transform: [{ scaleX: line }] }]}>
            <LinearGradient
              colors={['transparent', colors.accent, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.line}
            />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(8,9,11,0.78)', zIndex: 100 },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner: { alignItems: 'center' },
  phrase: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: FontWeight.heavy,
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 42,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  lineWrap: { width: 160, height: 3, marginTop: 18 },
  line: { flex: 1, borderRadius: 2 },
});

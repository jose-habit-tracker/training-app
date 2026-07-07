import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(e) => { scale.value = withSpring(0.97, { damping: 20, stiffness: 300 }); onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, { damping: 20, stiffness: 300 }); onPressOut?.(e); }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

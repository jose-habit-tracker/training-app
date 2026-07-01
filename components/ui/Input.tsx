import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  ViewStyle,
  StyleSheet,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
}

export function Input({
  label,
  error,
  containerStyle,
  multiline = false,
  style,
  ...rest
}: InputProps) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.accent
    : colors.border;

  const bgColor = focused
    ? colors.card
    : isDark
    ? 'rgba(255,255,255,0.04)'
    : 'rgba(255,255,255,0.45)';

  const inputStyle: ViewStyle = {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor,
    backgroundColor: bgColor,
    paddingVertical: Spacing.inputPaddingV,
    paddingHorizontal: Spacing.inputPaddingH,
    minHeight: multiline ? 84 : 42,
    // Focus halo — elevation on Android, stronger border handles both platforms
    ...(focused && !error ? { elevation: 3 } : { elevation: 0 }),
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          style={{
            fontSize: FontSize.sm,
            fontWeight: FontWeight.heavy,
            color: focused ? colors.accent : colors.text3,
            marginBottom: Spacing.gapXs,
            letterSpacing: 0.3,
          }}
        >
          {label}
        </Text>
      ) : null}

      <TextInput
        style={[
          inputStyle,
          {
            color: colors.text,
            fontSize: FontSize.md,
          },
          multiline && styles.textarea,
          style,
        ]}
        placeholderTextColor={colors.text3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...rest}
      />

      {error ? (
        <Text
          style={{
            fontSize: FontSize.sm,
            color: colors.danger,
            marginTop: Spacing.gapXs,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  textarea: {
    paddingTop: 11,
    lineHeight: 20,
  },
});

export type { InputProps };

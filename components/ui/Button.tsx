import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'mini' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const { colors, shadows, radius, spacing, fontSize, fontWeight } = useTheme();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.gapXs,
    borderRadius: variant === 'mini' ? radius.pill : radius.md,
    paddingVertical: variant === 'mini' ? spacing.miniBtnPaddingV : spacing.buttonPaddingV,
    paddingHorizontal: variant === 'mini' ? spacing.miniBtnPaddingH : spacing.buttonPaddingH,
    opacity: disabled ? 0.45 : 1,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    ...getVariantStyle(variant, colors, shadows),
  };

  const labelStyle: TextStyle = {
    fontSize: variant === 'mini' ? fontSize.base : fontSize.md,
    fontWeight: fontWeight.label,
    lineHeight: variant === 'mini' ? 14 : 16,
    ...getVariantTextStyle(variant, colors),
  };

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.card : colors.accent}
        />
      ) : (
        <>
          {icon}
          <Text style={[labelStyle, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Variant helpers ──────────────────────────────────────────────────────────

function getVariantStyle(
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
): ViewStyle {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: colors.text,
        ...shadows.button,
      };
    case 'secondary':
      return {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
      };
    case 'danger':
      return {
        backgroundColor: colors.dangerSoft,
      };
    case 'mini':
      return {
        backgroundColor: colors.text,
        ...shadows.button,
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
      };
    default:
      return {};
  }
}

function getVariantTextStyle(
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>['colors']
): TextStyle {
  switch (variant) {
    case 'primary':
    case 'mini':
      return { color: colors.card };
    case 'secondary':
      return { color: colors.text2 };
    case 'danger':
      return { color: colors.danger };
    case 'ghost':
      return { color: colors.accent };
    default:
      return {};
  }
}

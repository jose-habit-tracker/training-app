import { useColorScheme } from 'react-native';
import { getColors, ThemeColors, Shadows } from '../constants/colors';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, TextStyles } from '../constants/typography';

export interface Theme {
  colors: ThemeColors;
  shadows: typeof Shadows;
  spacing: typeof Spacing;
  radius: typeof Radius;
  fontSize: typeof FontSize;
  fontWeight: typeof FontWeight;
  text: typeof TextStyles;
  isDark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return {
    colors: getColors(scheme),
    shadows: Shadows,
    spacing: Spacing,
    radius: Radius,
    fontSize: FontSize,
    fontWeight: FontWeight,
    text: TextStyles,
    isDark: scheme === 'dark',
  };
}

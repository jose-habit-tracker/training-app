import { getColors, ThemeColors, Shadows } from '../constants/colors';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, TextStyles } from '../constants/typography';
import { useThemeMode } from '../lib/ThemeContext';

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
  const { theme } = useThemeMode();
  return {
    colors: getColors(theme),
    shadows: Shadows,
    spacing: Spacing,
    radius: Radius,
    fontSize: FontSize,
    fontWeight: FontWeight,
    text: TextStyles,
    isDark: theme === 'dark',
  };
}

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Web no soporta hápticos; el wrapper evita condicionales en los componentes.
export function tapLight(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function tapSuccess(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

import { Platform } from 'react-native';

// En web el proxy es relativo; en nativo hace falta la URL absoluta del deploy.
export function apiUrl(path: string): string {
  if (Platform.OS === 'web') return path;
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!base) throw new Error('EXPO_PUBLIC_API_BASE_URL no configurada');
  return `${base.replace(/\/$/, '')}${path}`;
}

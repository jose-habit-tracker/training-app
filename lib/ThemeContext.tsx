import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeName } from '../constants/colors';
import { storage } from './storage';

const STORAGE_KEY = 'theme';
const VALID: readonly ThemeName[] = ['light', 'dark', 'nude'];

interface ThemeModeValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeModeContext = createContext<ThemeModeValue>({
  theme: 'dark',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Valor inicial: mejor estimación desde el esquema del sistema (claro/oscuro).
  // El tema guardado (incl. nude o una elección contraria al sistema) se aplica
  // al resolver el almacenamiento; puede haber un breve reajuste en arranque en frío.
  const [theme, setThemeState] = useState<ThemeName>(system === 'light' ? 'light' : 'dark');

  useEffect(() => {
    storage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && (VALID as string[]).includes(saved)) {
          setThemeState(saved as ThemeName);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    storage.setItem(STORAGE_KEY, t).catch(() => {});
  };

  return (
    <ThemeModeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);

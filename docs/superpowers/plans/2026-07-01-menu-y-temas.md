# Menú de cuenta + temas conmutables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un menú de cuenta (avatar en el header) con cambio de tema, editar plan, ajustes y cerrar sesión, y hacer que los temas Dark/White/Nude sean conmutables por el usuario y persistentes en toda la app.

**Architecture:** Un `ThemeProvider` (React Context) sostiene el tema activo (`'dark' | 'light' | 'nude'`), lo persiste con `lib/storage.ts` y lo expone vía `useThemeMode()`. El hook existente `hooks/useTheme.ts` pasa a leer del contexto en vez de `useColorScheme()`, de modo que migrando los 15 call-sites de `getColors(useColorScheme())` a `useTheme()` toda la app respeta el tema. Un componente `AccountMenu` (avatar + popover con `Modal`) vive en el `headerRight` global de las tabs.

**Tech Stack:** React Native + Expo SDK 56, TypeScript estricto, Expo Router, Supabase, expo-secure-store (vía `lib/storage.ts`), `@expo/vector-icons` (Ionicons).

**Verificación:** El proyecto no tiene test runner. Cada tarea se verifica con `npx tsc --noEmit` (debe pasar sin errores) y, donde se indique, con ejecución manual (`npm run ios` / `npm run web`). Todos los commits terminan con la línea `Co-Authored-By`.

**Nota sobre baseline:** Ejecuta `npx tsc --noEmit` **antes de empezar** para confirmar que el árbol está limpio de errores de tipos. Si ya hubiera errores previos ajenos a este trabajo, anótalos para no confundirlos con regresiones.

---

## File Structure

**Nuevos:**
- `lib/ThemeContext.tsx` — Provider + hook `useThemeMode()`; estado del tema y persistencia.
- `components/ui/AccountMenu.tsx` — Avatar disparador (`AccountAvatar`) + popover con opciones (export por defecto `AccountMenu`).

**Modificados (núcleo):**
- `constants/colors.ts` — paleta `nude`, `type ThemeName`, `getColors(name: ThemeName)`.
- `hooks/useTheme.ts` — leer del contexto.
- `app/_layout.tsx` — montar `ThemeProvider`; `StatusBar` según tema.
- `app/(tabs)/_layout.tsx` — colores desde contexto + `headerRight` global con el avatar.

**Modificados (migración mecánica de tema):**
`app/index.tsx`, `app/ajustes.tsx`, `app/chat/[id].tsx`, `app/plan/[day].tsx`, `app/plan/index.tsx`, `app/(tabs)/hoy.tsx`, `app/(tabs)/historial.tsx`, `app/(tabs)/semana.tsx`, `app/(tabs)/chat.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/log/[day].tsx`, `components/ui/Input.tsx`.

---

## Task 1: Paleta `nude` + `ThemeName` en `constants/colors.ts`

**Files:**
- Modify: `constants/colors.ts`

- [ ] **Step 1: Añadir la paleta `nude`**

Justo después del bloque `const dark = { ... } as const;` (línea ~59), añade:

```ts
// ─── Nude theme ───────────────────────────────────────────────────────────────
const nude = {
  background: '#f6efe3',
  card: '#fdf9f2',
  accent: '#b97a55',
  accentSoft: '#eadfce',
  danger: '#c0392b',
  dangerSoft: 'rgba(192,57,43,0.12)',
  text: '#3d342a',
  text2: '#5c4f40',
  text3: '#9a8c78',
  border: 'rgba(90,70,40,0.10)',
  glassBg: 'rgba(253,249,242,0.60)',
  glassBorder: 'rgba(90,70,40,0.10)',
  shadow: 'rgba(90,70,40,0.08)',
  ripple: 'rgba(90,70,40,0.12)',
  catTrabajo: '#4A6FA5',
  catSalud: '#4E8C6A',
  catEstudio: '#7258A0',
  catComida: '#9A7240',
  catPersonal: '#A05860',
  orange: '#ff9f0a',
  blue: '#0a84ff',
  purple: '#bf5af2',
  teal: '#5ac8fa',
  yellow: '#ffd60a',
} as const;
```

- [ ] **Step 2: Definir `ThemeName`, actualizar `themes` y `getColors`**

Reemplaza el bloque actual (líneas ~89-93):

```ts
export const themes = { light, dark } as const;

export function getColors(scheme: ColorSchemeName): ThemeColors {
  return scheme === 'dark' ? dark : light;
}
```

por:

```ts
export type ThemeName = 'light' | 'dark' | 'nude';

export const themes = { light, dark, nude } as const;

export function getColors(name: ThemeName): ThemeColors {
  return themes[name];
}
```

Elimina el import ya no usado `import { ColorSchemeName } from 'react-native';` de la línea 1 (queda sin usos).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: Fallará **solo** en los call-sites que pasan `useColorScheme()` (un `ColorSchemeName | null`) a `getColors`, que ahora espera `ThemeName`. Esto es esperado; se corrige en tareas siguientes. No debe haber errores dentro de `constants/colors.ts`.

- [ ] **Step 4: Commit**

```bash
git add constants/colors.ts
git commit -m "$(cat <<'EOF'
Add nude theme palette and ThemeName type

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `ThemeProvider` y `useThemeMode()`

**Files:**
- Create: `lib/ThemeContext.tsx`

- [ ] **Step 1: Crear el contexto**

Crea `lib/ThemeContext.tsx`:

```tsx
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
  // Primer render: deriva del sistema para evitar flash de tema incorrecto.
  const [theme, setThemeState] = useState<ThemeName>(system === 'light' ? 'light' : 'dark');

  useEffect(() => {
    storage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && (VALID as string[]).includes(saved)) {
        setThemeState(saved as ThemeName);
      }
    });
  }, []);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    storage.setItem(STORAGE_KEY, t);
  };

  return (
    <ThemeModeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: Sin errores nuevos en `lib/ThemeContext.tsx` (los errores de call-sites de Task 1 siguen presentes; se resuelven después).

- [ ] **Step 3: Commit**

```bash
git add lib/ThemeContext.tsx
git commit -m "$(cat <<'EOF'
Add ThemeProvider with persisted theme selection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `useTheme` lee del contexto + montar el Provider

**Files:**
- Modify: `hooks/useTheme.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Actualizar `hooks/useTheme.ts`**

Reemplaza el contenido completo por:

```ts
import { getColors, ThemeColors } from '../constants/colors';
import { Shadows } from '../constants/colors';
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
```

- [ ] **Step 2: Montar `ThemeProvider` en `app/_layout.tsx`**

En `app/_layout.tsx`, añade el import bajo los otros imports de `lib` (junto a `PlanProvider`):

```tsx
import { ThemeProvider } from '../lib/ThemeContext';
```

Envuelve el contenido con `ThemeProvider` justo dentro de `AuthProvider` (fuera de `PlanProvider`). El bloque `return` de `RootLayout` queda:

```tsx
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ThemeProvider>
            <PlanProvider>
              <ThemedStatusBar />
              <NavigationGuard />
              <Stack screenOptions={{ headerShown: false }}>
                {/* ...las Stack.Screen existentes sin cambios... */}
              </Stack>
            </PlanProvider>
          </ThemeProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
```

> Mantén todas las `<Stack.Screen ...>` existentes tal cual dentro del `<Stack>`.

- [ ] **Step 3: `StatusBar` según tema**

Sustituye el `import { StatusBar } from 'expo-status-bar';` para poder usar el hook, y reemplaza `<StatusBar style="auto" />` por un componente que lee el tema. Añade, encima de `function RootLayout()`:

```tsx
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
```

Y añade el import del hook cerca de los demás:

```tsx
import { useTheme } from '../hooks/useTheme';
```

`ThemedStatusBar` debe renderizarse **dentro** de `ThemeProvider` (ya lo está en el bloque del Step 2).

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: Los errores restantes son únicamente los call-sites que aún llaman `getColors(useColorScheme())` (Tasks 4-6). `hooks/useTheme.ts` y `app/_layout.tsx` sin errores.

- [ ] **Step 5: Commit**

```bash
git add hooks/useTheme.ts app/_layout.tsx
git commit -m "$(cat <<'EOF'
Wire useTheme to ThemeProvider and theme the status bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrar pantallas de tabs y ajustes al hook `useTheme`

**Patrón de migración (aplícalo idéntico en cada archivo):**

1. Quita `useColorScheme` del import de `'react-native'`.
2. Quita `getColors` del import de `'../../constants/colors'` (o `'../constants/colors'`). **Si el import también trae `SessionColors` u otros, consérvalos** — quita solo `getColors`.
3. Añade el import del hook: `import { useTheme } from '../../hooks/useTheme';` (ajusta `../` según la profundidad del archivo).
4. Dentro del componente, reemplaza `const colors = getColors(useColorScheme());` por `const { colors } = useTheme();`.

**Files:**
- Modify: `app/(tabs)/hoy.tsx` (import trae también `SessionColors` → consérvalo; ruta del hook: `../../hooks/useTheme`)
- Modify: `app/(tabs)/semana.tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/(tabs)/chat.tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/(tabs)/historial.tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/ajustes.tsx` (ruta: `../hooks/useTheme`)

- [ ] **Step 1: Migrar los 5 archivos** siguiendo el patrón anterior.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: Desaparecen los errores de estos 5 archivos. Quedan solo los de Task 5 y el `_layout` de tabs (Task 6).

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/hoy.tsx" "app/(tabs)/semana.tsx" "app/(tabs)/chat.tsx" "app/(tabs)/historial.tsx" app/ajustes.tsx
git commit -m "$(cat <<'EOF'
Migrate tab screens and settings to useTheme

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migrar pantallas restantes y componente `Input`

**Aplica el mismo patrón de migración de Task 4.** Nota de rutas: los archivos bajo `app/` a un nivel usan `../hooks/useTheme`; los de `app/chat/`, `app/plan/`, `app/log/`, `app/(auth)/` están a dos niveles → `../../hooks/useTheme`; `components/ui/Input.tsx` → `../../hooks/useTheme`.

**Files:**
- Modify: `app/index.tsx` (ruta: `../hooks/useTheme`)
- Modify: `app/chat/[id].tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/plan/[day].tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/plan/index.tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/log/[day].tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/(auth)/login.tsx` (ruta: `../../hooks/useTheme`)
- Modify: `app/(auth)/register.tsx` (ruta: `../../hooks/useTheme`)
- Modify: `components/ui/Input.tsx` (ruta: `../../hooks/useTheme`)

Ejemplo concreto para `app/index.tsx` (reemplazo completo):

```tsx
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function Index() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
```

- [ ] **Step 1: Migrar los 8 archivos.**

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: Sin errores salvo, como mucho, `app/(tabs)/_layout.tsx` (Task 6).

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx "app/chat/[id].tsx" "app/plan/[day].tsx" app/plan/index.tsx "app/log/[day].tsx" "app/(auth)/login.tsx" "app/(auth)/register.tsx" components/ui/Input.tsx
git commit -m "$(cat <<'EOF'
Migrate remaining screens and Input to useTheme

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `AccountMenu` (avatar + popover)

**Files:**
- Create: `components/ui/AccountMenu.tsx`

- [ ] **Step 1: Crear el componente**

Crea `components/ui/AccountMenu.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useThemeMode } from '../../lib/ThemeContext';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { ThemeName } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

const THEME_OPTIONS: { key: ThemeName; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'White' },
  { key: 'nude', label: 'Nude' },
];

function confirmSignOut(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm('¿Cerrar sesión?')) onConfirm();
  } else {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export function AccountMenu() {
  const { colors } = useTheme();
  const { theme, setTheme } = useThemeMode();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);

  const email = session?.user.email ?? '';
  const initial = (email[0] ?? '?').toUpperCase();
  const name = email.split('@')[0] || 'Usuario';

  const go = (path: '/plan' | '/ajustes') => {
    setOpen(false);
    router.push(path);
  };

  const handleSignOut = () => {
    confirmSignOut(async () => {
      setOpen(false);
      await supabase.auth.signOut();
    });
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={[s.avatar, { backgroundColor: colors.accent }]}
        hitSlop={8}
      >
        <Text style={s.avatarText}>{initial}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[s.panel, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={s.header}>
              <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
              <Text style={[s.email, { color: colors.text3 }]} numberOfLines={1}>{email}</Text>
            </View>

            <View style={[s.sep, { backgroundColor: colors.border }]} />

            <View style={s.themeBlock}>
              <Text style={[s.themeLabel, { color: colors.text3 }]}>TEMA</Text>
              <View style={s.seg}>
                {THEME_OPTIONS.map((opt) => {
                  const active = theme === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setTheme(opt.key)}
                      activeOpacity={0.8}
                      style={[
                        s.segBtn,
                        { borderColor: colors.border },
                        active && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[s.segText, { color: active ? '#fff' : colors.text2 }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[s.sep, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={s.row} onPress={() => go('/plan')} activeOpacity={0.7}>
              <Ionicons name="clipboard-outline" size={19} color={colors.text2} style={s.rowIcon} />
              <Text style={[s.rowText, { color: colors.text }]}>Editar plan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.row} onPress={() => go('/ajustes')} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={19} color={colors.text2} style={s.rowIcon} />
              <Text style={[s.rowText, { color: colors.text }]}>Ajustes</Text>
            </TouchableOpacity>

            <View style={[s.sep, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={19} color={colors.danger} style={s.rowIcon} />
              <Text style={[s.rowText, { color: colors.danger }]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  avatar: {
    width: 34, height: 34, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.lg,
  },
  avatarText: { color: '#fff', fontSize: FontSize.body, fontWeight: FontWeight.label },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  panel: {
    position: 'absolute', top: Platform.OS === 'ios' ? 92 : 64, right: 12,
    width: 252, borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.s,
    shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.s },
  name: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  email: { fontSize: FontSize.base, marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xxs },
  themeBlock: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  themeLabel: { fontSize: FontSize.s, fontWeight: FontWeight.heavy, letterSpacing: 0.5, marginBottom: Spacing.sm },
  seg: { flexDirection: 'row', gap: Spacing.s },
  segBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center' },
  segText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.base },
  rowIcon: { marginRight: Spacing.base, width: 22 },
  rowText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
});
```

> `router.push('/plan')` apunta a `app/plan/index.tsx` y `router.push('/ajustes')` a `app/ajustes.tsx`, ambas ya registradas en el `Stack` raíz.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: Sin errores en `components/ui/AccountMenu.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/AccountMenu.tsx
git commit -m "$(cat <<'EOF'
Add AccountMenu: avatar trigger and popover with theme switch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Integrar el avatar en el header de las tabs

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Migrar colores y añadir `headerRight` global**

Reemplaza el contenido completo de `app/(tabs)/_layout.tsx` por:

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ColorValue } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AccountMenu } from '../../components/ui/AccountMenu';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IoniconName; color: ColorValue }) {
  return <Ionicons name={name} size={22} color={color as string} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
        },
        headerShadowVisible: false,
        headerRight: () => <AccountMenu />,
      }}
    >
      <Tabs.Screen
        name="hoy"
        options={{
          title: 'Hoy',
          headerTitle: 'Entrenamiento de hoy',
          tabBarIcon: ({ color }) => <TabIcon name="flame" color={color} />,
        }}
      />
      <Tabs.Screen
        name="semana"
        options={{
          title: 'Semana',
          headerTitle: 'Vista semanal',
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Coach IA',
          headerTitle: 'Coach IA',
          tabBarIcon: ({ color }) => <TabIcon name="chatbubble" color={color} />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          headerTitle: 'Historial',
          tabBarIcon: ({ color }) => <TabIcon name="bar-chart" color={color} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: **Cero errores** en todo el proyecto (toda la migración completa).

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/_layout.tsx"
git commit -m "$(cat <<'EOF'
Add account avatar to tab headers and theme the tab bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verificación manual end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Arrancar la app**

Run: `npm run ios` (o `npm run web`)
Expected: La app arranca sin pantalla roja de error.

- [ ] **Step 2: Comprobaciones funcionales** (marca cada una)

- [ ] El avatar con la inicial aparece arriba a la derecha en las 4 tabs (Hoy/Semana/Chat/Historial).
- [ ] Tocar el avatar abre el popover; tocar fuera (backdrop) lo cierra.
- [ ] El selector de tema cambia entre **Dark / White / Nude** al instante y afecta a toda la pantalla visible.
- [ ] Navegar por las tabs y entrar en login/registro (cerrando sesión), editor de plan y ajustes: **todas** respetan el tema elegido.
- [ ] "Editar plan" abre `plan/index`; "Ajustes" abre la pantalla de API key de Groq.
- [ ] "Cerrar sesión" pide confirmación y, al aceptar, redirige a login.
- [ ] Cerrar del todo la app y reabrir: el tema elegido **persiste**.
- [ ] En un arranque limpio (borra datos/`localStorage`), el tema inicial coincide con el del sistema (oscuro→Dark, claro→White).
- [ ] Contraste legible en los 3 temas, con atención al Nude (texto marrón sobre crema, acento terracota).

- [ ] **Step 3: Confirmar tipos finales**

Run: `npx tsc --noEmit`
Expected: Cero errores.

- [ ] **Step 4: (Si algo falla)** Anota el problema y corrígelo en un commit específico antes de dar por cerrado el trabajo.

---

## Self-review (cobertura del spec)

- Paleta nude → Task 1. ✅
- `ThemeName` + `getColors(name)` → Task 1. ✅
- `ThemeContext` con persistencia y derivado del sistema en primer arranque → Task 2. ✅
- `useTheme` lee del contexto + `ThemeProvider` montado + StatusBar por tema → Task 3. ✅
- Migración de los 15 call-sites → Tasks 3 (useTheme.ts), 4, 5, 7 (_layout tabs) + `_layout.tsx` raíz en Task 3. ✅
- `AccountMenu` (avatar + popover: cabecera, tema segmentado, editar plan, ajustes, cerrar sesión con confirmación) → Task 6. ✅
- Avatar en `headerRight` global → Task 7. ✅
- Sin extras (solo esencial) → respetado. ✅
- Verificación manual de temas, persistencia, contraste → Task 8. ✅
```

# Editor adaptativo + Agenda + paquete premium — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editor de plan con campos por deporte (sin «Carga» en natación), pestaña Agenda con carreras (cuenta atrás, resultados, análisis IA) y calendario de eventos manuales, más micro-interacciones premium.

**Architecture:** La lógica pura (campos por deporte, resúmenes, fases, PB, tiempos, grid mensual) vive en `lib/` y se testea con vitest en node (patrón `tests/coach/`). La UI consume esa lógica desde componentes pequeños en `components/training/` y `components/agenda/`. Datos nuevos en tabla `events` de Supabase (RLS owner-only, escritura cliente con JWT — el servidor nunca tiene `service_role`).

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript estricto, Reanimated 4.3.1 (ya instalado), react-native-svg (ya instalado), expo-haptics + expo-linear-gradient (nuevos), Supabase, vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-editor-adaptativo-agenda-premium-design.md`

**Comandos del proyecto:**
- Tests: `npm test` (vitest run) o `npx vitest run tests/agenda/phases.test.ts`
- Typecheck: `npx tsc --noEmit`
- App web: `npm run web`

**Convenciones (de CLAUDE.md):** TypeScript estricto sin `any`; tipos compartidos en `types/index.ts`; `StyleSheet.create()` al final de cada archivo; textos UI en español, código en inglés; sin comentarios obvios. Los componentes usan `useTheme()` (hay 3 temas: light/dark/nude — **nunca colores hardcodeados** salvo `SessionColors`).

---

### Task 1: Config de campos por deporte (`lib/training/fields.ts`)

**Files:**
- Create: `lib/training/fields.ts`
- Test: `tests/training/fields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/training/fields.test.ts
import { describe, it, expect } from 'vitest';
import { editorSportOf, EDITOR_SPORTS, EXERCISE_FIELDS } from '../../lib/training/fields';

describe('editorSportOf', () => {
  it('mapea cada SessionType a su deporte de editor', () => {
    expect(editorSportOf('running_threshold')).toBe('run');
    expect(editorSportOf('swimming')).toBe('swim');
    expect(editorSportOf('gym_hyrox')).toBe('gym');
    expect(editorSportOf('hyrox_simulation')).toBe('hyrox');
    expect(editorSportOf('active_recovery')).toBe('rest');
  });
});

describe('EDITOR_SPORTS', () => {
  it('cubre los 10 SessionType sin repetir', () => {
    const all = EDITOR_SPORTS.flatMap((s) => s.types);
    expect(all).toHaveLength(10);
    expect(new Set(all).size).toBe(10);
  });
});

describe('EXERCISE_FIELDS', () => {
  it('natación no muestra carga y sí distancia con presets', () => {
    const keys = EXERCISE_FIELDS.swim.map((f) => f.key);
    expect(keys).not.toContain('load');
    expect(keys).toContain('distance');
    const rest = EXERCISE_FIELDS.swim.find((f) => f.key === 'rest');
    expect(rest?.presets).toContain('30s');
  });
  it('gym muestra carga y no distancia', () => {
    const keys = EXERCISE_FIELDS.gym.map((f) => f.key);
    expect(keys).toContain('load');
    expect(keys).not.toContain('distance');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/training/fields.test.ts`
Expected: FAIL — `Cannot find module '../../lib/training/fields'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/training/fields.ts
import type { SessionType } from '../../types';

export type EditorSport = 'run' | 'swim' | 'gym' | 'hyrox' | 'rest';

export interface EditorSportDef {
  key: EditorSport;
  label: string;
  icon: string;
  types: SessionType[];
}

export const EDITOR_SPORTS: EditorSportDef[] = [
  { key: 'run', label: 'Run', icon: '🏃', types: ['running_easy', 'running_threshold', 'running_long', 'running_intervals'] },
  { key: 'swim', label: 'Swim', icon: '🏊', types: ['swimming'] },
  { key: 'gym', label: 'Gym', icon: '🏋️', types: ['gym_strength', 'gym_hyrox'] },
  { key: 'hyrox', label: 'Hyrox', icon: '⚡', types: ['hyrox_simulation'] },
  { key: 'rest', label: 'Descanso', icon: '😌', types: ['rest', 'active_recovery'] },
];

export function editorSportOf(type: SessionType): EditorSport {
  const def = EDITOR_SPORTS.find((s) => s.types.includes(type));
  return def?.key ?? 'rest';
}

export type ExerciseFieldKey = 'sets' | 'reps' | 'load' | 'distance' | 'duration' | 'rest' | 'notes';

export interface FieldSpec {
  key: ExerciseFieldKey;
  label: string;
  placeholder: string;
  numeric?: boolean;
  presets?: string[];
}

const REST_PRESETS = ['15s', '20s', '30s', '45s', '1 min', '2 min'];

// Qué campos de ExerciseTemplate se muestran por deporte, con etiquetas y atajos.
// Los presets rellenan el campo; la escritura manual siempre está disponible.
export const EXERCISE_FIELDS: Record<EditorSport, FieldSpec[]> = {
  swim: [
    { key: 'sets', label: 'Series', placeholder: '8', numeric: true },
    { key: 'distance', label: 'Distancia', placeholder: '100m', presets: ['25m', '50m', '100m', '200m', '400m'] },
    { key: 'rest', label: 'Descanso', placeholder: '30s', presets: REST_PRESETS },
    { key: 'notes', label: 'Estilo / foco', placeholder: 'Crol', presets: ['Crol', 'Espalda', 'Pull', 'Técnica', 'Pies'] },
  ],
  gym: [
    { key: 'sets', label: 'Series', placeholder: '4', numeric: true },
    { key: 'reps', label: 'Reps', placeholder: '8 por lado' },
    { key: 'load', label: 'Carga', placeholder: '40 kg', presets: ['Peso corporal', '10 kg', '20 kg', '40 kg', '60 kg'] },
    { key: 'rest', label: 'Descanso', placeholder: '90s', presets: REST_PRESETS },
    { key: 'notes', label: 'Notas', placeholder: 'Técnica sobre carga' },
  ],
  run: [
    { key: 'sets', label: 'Series', placeholder: '6', numeric: true },
    { key: 'distance', label: 'Distancia', placeholder: '400m', presets: ['200m', '400m', '1km', '2km'] },
    { key: 'duration', label: 'Duración', placeholder: '15 min', presets: ['5 min', '10 min', '15 min', '30 min'] },
    { key: 'rest', label: 'Descanso', placeholder: '2 min', presets: REST_PRESETS },
    { key: 'notes', label: 'Ritmo / foco', placeholder: 'z2 cómodo', presets: ['z1-z2', 'z3', 'umbral z4', '5k pace'] },
  ],
  hyrox: [
    { key: 'sets', label: 'Series', placeholder: '4', numeric: true },
    { key: 'reps', label: 'Reps', placeholder: '20' },
    { key: 'load', label: 'Carga', placeholder: '60 kg' },
    { key: 'distance', label: 'Distancia', placeholder: '1000m', presets: ['50m', '100m', '500m', '1000m'] },
    { key: 'duration', label: 'Duración', placeholder: '15 min' },
    { key: 'rest', label: 'Descanso', placeholder: '90s', presets: REST_PRESETS },
    { key: 'notes', label: 'Notas', placeholder: 'Ritmo constante' },
  ],
  rest: [
    { key: 'duration', label: 'Duración', placeholder: '10 min', presets: ['5 min', '10 min', '15 min'] },
    { key: 'notes', label: 'Notas', placeholder: 'Foam roller suave' },
  ],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/training/fields.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/training/fields.ts tests/training/fields.test.ts
git commit -m "feat: config de campos de ejercicio por deporte para el editor"
```

---

### Task 2: Resúmenes y totales (`lib/training/summary.ts`)

**Files:**
- Create: `lib/training/summary.ts`
- Test: `tests/training/summary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/training/summary.test.ts
import { describe, it, expect } from 'vitest';
import { exerciseSummary, sessionTotals } from '../../lib/training/summary';
import type { ExerciseTemplate } from '../../types';

const ex = (partial: Partial<ExerciseTemplate>): ExerciseTemplate => ({ id: 'x', name: 'Test', ...partial });

describe('exerciseSummary', () => {
  it('natación: series×distancia con descanso', () => {
    expect(exerciseSummary(ex({ sets: 8, distance: '100m', rest: '30s' }))).toBe('8×100m · desc 30s');
  });
  it('gym: series×reps con carga', () => {
    expect(exerciseSummary(ex({ sets: 4, reps: '8 por lado', load: '20 kg' }))).toBe('4×8 por lado · 20 kg');
  });
  it('solo duración', () => {
    expect(exerciseSummary(ex({ duration: '15 min' }))).toBe('15 min');
  });
  it('sin datos devuelve cadena vacía', () => {
    expect(exerciseSummary(ex({}))).toBe('');
  });
});

describe('sessionTotals', () => {
  it('suma metros en natación (sets × distancia en m)', () => {
    const list = [ex({ distance: '200m' }), ex({ sets: 8, distance: '100m' }), ex({ sets: 6, distance: '50m' })];
    expect(sessionTotals(list, 'swim')).toBe('1.300 m totales');
  });
  it('gym cuenta ejercicios', () => {
    expect(sessionTotals([ex({}), ex({})], 'gym')).toBe('2 ejercicios');
  });
  it('lista vacía devuelve cadena vacía', () => {
    expect(sessionTotals([], 'swim')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/training/summary.test.ts`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/training/summary.ts
import type { ExerciseTemplate } from '../../types';
import type { EditorSport } from './fields';

// Resumen de una línea para la cabecera colapsada del acordeón.
export function exerciseSummary(ex: ExerciseTemplate): string {
  const parts: string[] = [];
  const volume = ex.distance ?? ex.reps ?? ex.duration;
  if (ex.sets != null && volume) parts.push(`${ex.sets}×${volume}`);
  else if (volume) parts.push(volume);
  if (ex.load) parts.push(ex.load);
  if (ex.rest) parts.push(`desc ${ex.rest}`);
  return parts.join(' · ');
}

function metersOf(ex: ExerciseTemplate): number {
  const m = ex.distance?.match(/^(\d+(?:[.,]\d+)?)\s*(m|km)$/i);
  if (!m) return 0;
  const value = parseFloat(m[1].replace(',', '.'));
  const meters = m[2].toLowerCase() === 'km' ? value * 1000 : value;
  return meters * (ex.sets ?? 1);
}

export function sessionTotals(exercises: ExerciseTemplate[], sport: EditorSport): string {
  if (exercises.length === 0) return '';
  if (sport === 'swim' || sport === 'run') {
    const total = exercises.reduce((sum, ex) => sum + metersOf(ex), 0);
    if (total === 0) return `${exercises.length} bloques`;
    if (sport === 'run' && total >= 1000) return `${(total / 1000).toLocaleString('es-ES')} km totales`;
    return `${total.toLocaleString('es-ES')} m totales`;
  }
  return `${exercises.length} ejercicios`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/training/summary.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/training/summary.ts tests/training/summary.test.ts
git commit -m "feat: resumen de ejercicio y totales por deporte"
```

---

### Task 3: Dependencias premium + hápticos + PressableScale

**Files:**
- Modify: `package.json` (vía expo install)
- Create: `lib/haptics.ts`
- Create: `components/ui/PressableScale.tsx`

- [ ] **Step 1: Instalar dependencias**

Run: `npx expo install expo-haptics expo-linear-gradient`
Expected: ambas añadidas a `package.json` con versiones compatibles con SDK 56. Si npm falla por la caché rota de la máquina (EACCES en `~/.npm/_cacache`, ver `docs/BACKLOG.md` §10), NO uses `sudo`; reintenta con `npm install --cache /tmp/npm-cache-clean`.

- [ ] **Step 2: Wrapper de hápticos (no-op en web)**

```ts
// lib/haptics.ts
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
```

- [ ] **Step 3: PressableScale (feedback 0.97 con muelle)**

```tsx
// components/ui/PressableScale.tsx
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
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/haptics.ts components/ui/PressableScale.tsx
git commit -m "feat: expo-haptics + expo-linear-gradient, wrapper haptics y PressableScale"
```

---
### Task 4: Stepper y PresetChips

**Files:**
- Create: `components/training/Stepper.tsx`
- Create: `components/training/PresetChips.tsx`

- [ ] **Step 1: Stepper (− valor editable +)**

```tsx
// components/training/Stepper.tsx
import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { tapLight } from '../../lib/haptics';

interface StepperProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
}

export function Stepper({ label, value, onChange, min = 1, max = 99 }: StepperProps) {
  const { colors } = useTheme();

  const bump = (delta: number) => {
    tapLight();
    const next = Math.min(max, Math.max(min, (value ?? min - delta) + delta));
    onChange(next);
  };

  return (
    <View style={s.container}>
      <Text style={[s.label, { color: colors.text3 }]}>{label.toUpperCase()}</Text>
      <View style={[s.row, { backgroundColor: colors.glassBg, borderColor: colors.border }]}>
        <TouchableOpacity style={[s.btn, { backgroundColor: colors.card }]} onPress={() => bump(-1)} hitSlop={6}>
          <Text style={[s.btnText, { color: colors.accent }]}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={[s.value, { color: colors.text }]}
          value={value != null ? String(value) : ''}
          onChangeText={(v) => {
            const n = Number(v.replace(/[^0-9]/g, ''));
            onChange(v === '' ? undefined : Math.min(max, Math.max(min, n || min)));
          }}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.text3}
        />
        <TouchableOpacity style={[s.btn, { backgroundColor: colors.card }]} onPress={() => bump(1)} hitSlop={6}>
          <Text style={[s.btnText, { color: colors.accent }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.3, marginBottom: Spacing.gapXs },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.gapXs, minHeight: 42 },
  btn: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: FontSize.lg, fontWeight: FontWeight.black, lineHeight: 20 },
  value: { flex: 1, textAlign: 'center', fontSize: FontSize.md, fontWeight: FontWeight.heavy, paddingVertical: 0 },
});
```

Nota: si `constants/typography.ts` no exporta alguno de los pesos usados (`heavy`, `black`), abre el archivo y usa los nombres reales que exporte (mismo criterio en el resto de tareas).

- [ ] **Step 2: PresetChips (atajos que rellenan el campo)**

```tsx
// components/training/PresetChips.tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { tapLight } from '../../lib/haptics';

interface PresetChipsProps {
  presets: string[];
  value: string | undefined;
  onSelect: (v: string) => void;
  accent: string;
}

export function PresetChips({ presets, value, onSelect, accent }: PresetChipsProps) {
  const { colors } = useTheme();
  return (
    <View style={s.row}>
      {presets.map((p) => {
        const active = value === p;
        return (
          <TouchableOpacity
            key={p}
            style={[s.chip, { backgroundColor: active ? accent : colors.glassBg, borderColor: active ? accent : colors.border }]}
            onPress={() => { tapLight(); onSelect(p); }}
            activeOpacity={0.75}
          >
            <Text style={[s.text, { color: active ? '#fff' : colors.text3 }]}>{p}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapXs, marginTop: Spacing.gapXs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1 },
  text: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add components/training/Stepper.tsx components/training/PresetChips.tsx
git commit -m "feat: Stepper y PresetChips para el editor adaptativo"
```

---

### Task 5: SportSegment y VariantDropdown

**Files:**
- Create: `components/training/SportSegment.tsx`
- Create: `components/training/VariantDropdown.tsx`

- [ ] **Step 1: SportSegment (segmentado de 5 deportes)**

```tsx
// components/training/SportSegment.tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { EDITOR_SPORTS, EditorSport } from '../../lib/training/fields';
import { SessionColors } from '../../constants/colors';
import { tapLight } from '../../lib/haptics';

interface SportSegmentProps {
  sport: EditorSport;
  onChange: (sport: EditorSport) => void;
}

export function SportSegment({ sport, onChange }: SportSegmentProps) {
  const { colors } = useTheme();
  return (
    <View style={[s.track, { backgroundColor: colors.glassBg, borderColor: colors.border }]}>
      {EDITOR_SPORTS.map((def) => {
        const active = def.key === sport;
        const accent = SessionColors[def.types[0]] ?? colors.accent;
        return (
          <TouchableOpacity
            key={def.key}
            style={[s.segment, active && { backgroundColor: accent }]}
            onPress={() => { if (!active) { tapLight(); onChange(def.key); } }}
            activeOpacity={0.8}
          >
            <Text style={s.icon}>{def.icon}</Text>
            <Text style={[s.label, { color: active ? '#fff' : colors.text3 }]}>{def.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: 3, gap: 2 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.s, borderRadius: Radius.sm, gap: 1 },
  icon: { fontSize: FontSize.md },
  label: { fontSize: 10, fontWeight: FontWeight.heavy },
});
```

- [ ] **Step 2: VariantDropdown (Modal anclado, funciona en web y nativo)**

```tsx
// components/training/VariantDropdown.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { SessionType } from '../../types';
import { tapLight } from '../../lib/haptics';

interface VariantDropdownProps {
  options: SessionType[];
  value: SessionType;
  onChange: (t: SessionType) => void;
}

// Solo se renderiza si el deporte tiene más de una variante.
export function VariantDropdown({ options, value, onChange }: VariantDropdownProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;

  return (
    <View>
      <Text style={[s.label, { color: colors.text3 }]}>VARIANTE</Text>
      <TouchableOpacity
        style={[s.trigger, { backgroundColor: colors.glassBg, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[s.value, { color: colors.text }]}>{SESSION_LABELS[value] ?? value}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.text3} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {options.map((t) => {
              const active = t === value;
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.option, active && { backgroundColor: colors.accentSoft }]}
                  onPress={() => { tapLight(); onChange(t); setOpen(false); }}
                >
                  <Text style={[s.optionText, { color: active ? colors.accent : colors.text }]}>
                    {SESSION_LABELS[t] ?? t}
                  </Text>
                  {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65, marginBottom: Spacing.gapXs },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.inputPaddingH, minHeight: 42 },
  value: { fontSize: FontSize.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.xxl },
  sheet: { borderRadius: Radius.modal, borderWidth: 1, overflow: 'hidden' },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.base },
  optionText: { fontSize: FontSize.md, fontWeight: FontWeight.label },
});
```

- [ ] **Step 3: Typecheck y commit**

Run: `npx tsc --noEmit` → sin errores

```bash
git add components/training/SportSegment.tsx components/training/VariantDropdown.tsx
git commit -m "feat: segmentado de deporte y desplegable de variante"
```

---

### Task 6: ExerciseAccordion

**Files:**
- Create: `components/training/ExerciseAccordion.tsx`

- [ ] **Step 1: Componente**

Colapsado: nombre + resumen (`exerciseSummary`). Expandido: campos según `EXERCISE_FIELDS[sport]` — `sets` con Stepper, resto con Input + PresetChips si tiene presets. Reordenar con flechas ↑↓. Cuerpo expandido entra con `FadeInDown` y el chevron rota (Reanimated).

```tsx
// components/training/ExerciseAccordion.tsx
import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { ExerciseTemplate } from '../../types';
import { EditorSport, EXERCISE_FIELDS } from '../../lib/training/fields';
import { exerciseSummary } from '../../lib/training/summary';
import { Input } from '../ui/Input';
import { Stepper } from './Stepper';
import { PresetChips } from './PresetChips';
import { tapLight } from '../../lib/haptics';

interface ExerciseAccordionProps {
  exercise: ExerciseTemplate;
  index: number;
  total: number;
  sport: EditorSport;
  accent: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ExerciseTemplate>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

export function ExerciseAccordion({
  exercise, index, total, sport, accent, expanded, onToggle, onChange, onRemove, onMove,
}: ExerciseAccordionProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(expanded ? 90 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 90 : 0, { duration: 180 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const summary = exerciseSummary(exercise);
  const fields = EXERCISE_FIELDS[sport];

  return (
    <View style={[s.card, { backgroundColor: colors.glassBg, borderColor: expanded ? accent : colors.glassBorder }]}>
      <TouchableOpacity style={s.header} onPress={() => { tapLight(); onToggle(); }} activeOpacity={0.8}>
        <View style={s.headerLeft}>
          <Text style={[s.index, { color: accent }]}>#{index + 1}</Text>
          <View style={s.headerText}>
            <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>
              {exercise.name || 'Ejercicio sin nombre'}
            </Text>
            {!expanded && !!summary && (
              <Text style={[s.summary, { color: accent }]} numberOfLines={1}>{summary}</Text>
            )}
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={16} color={colors.text3} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(180)} style={s.body}>
          <Input value={exercise.name} onChangeText={(v) => onChange({ name: v })} placeholder="Nombre del ejercicio" />

          {fields.map((f) =>
            f.key === 'sets' ? (
              <Stepper key={f.key} label={f.label} value={exercise.sets} onChange={(v) => onChange({ sets: v })} />
            ) : (
              <View key={f.key}>
                <Input
                  label={f.label}
                  value={exercise[f.key] ?? ''}
                  onChangeText={(v) => onChange({ [f.key]: v || undefined })}
                  placeholder={f.placeholder}
                />
                {f.presets && (
                  <PresetChips
                    presets={f.presets}
                    value={exercise[f.key]}
                    onSelect={(v) => onChange({ [f.key]: v })}
                    accent={accent}
                  />
                )}
              </View>
            ),
          )}

          <View style={s.actions}>
            <View style={s.moveButtons}>
              <TouchableOpacity onPress={() => onMove(-1)} disabled={index === 0} hitSlop={6}>
                <Ionicons name="arrow-up-circle-outline" size={22} color={index === 0 ? colors.border : colors.text3} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onMove(1)} disabled={index === total - 1} hitSlop={6}>
                <Ionicons name="arrow-down-circle-outline" size={22} color={index === total - 1 ? colors.border : colors.text3} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onRemove} hitSlop={6}>
              <Text style={[s.remove, { color: colors.danger }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  headerText: { flex: 1 },
  index: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  summary: { fontSize: FontSize.base, marginTop: 2 },
  body: { gap: Spacing.gapSm, marginTop: Spacing.base },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.gapXs },
  moveButtons: { flexDirection: 'row', gap: Spacing.gapSm },
  remove: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});
```

Nota TS: `exercise[f.key]` indexa campos string opcionales; `sets` (number) se maneja aparte con el Stepper, así que el acceso es seguro. Si tsc se queja del index, tipa `f.key` como `Exclude<ExerciseFieldKey, 'sets'>` en la rama del else.

- [ ] **Step 2: Typecheck y commit**

Run: `npx tsc --noEmit` → sin errores

```bash
git add components/training/ExerciseAccordion.tsx
git commit -m "feat: acordeón de ejercicio con campos por deporte"
```

---

### Task 7: Reescribir el editor del plan (`app/plan/[day].tsx`)

**Files:**
- Modify: `app/plan/[day].tsx` (cuerpo completo)

- [ ] **Step 1: Reescribir la pantalla**

Sustituye el contenido del return y los handlers. Se conservan: `usePlan`, guardado con limpieza de ejercicios sin nombre, `SessionColors`. Cambios: segmentado + desplegable en lugar de 10 chips; confirmación antes de machacar ejercicios al cambiar de plantilla; acordeón (uno abierto a la vez); totales en cabecera.

```tsx
// app/plan/[day].tsx — archivo completo
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { SessionColors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_DEFAULTS } from '../../constants/trainingPlan';
import { DayPlan, ExerciseTemplate, SessionType } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SportSegment } from '../../components/training/SportSegment';
import { VariantDropdown } from '../../components/training/VariantDropdown';
import { ExerciseAccordion } from '../../components/training/ExerciseAccordion';
import { EDITOR_SPORTS, editorSportOf, EditorSport } from '../../lib/training/fields';
import { sessionTotals } from '../../lib/training/summary';
import { usePlan } from '../../lib/PlanContext';
import { tapSuccess } from '../../lib/haptics';

// confirm() en web, Alert en nativo — Alert.alert no bloquea en react-native-web.
function confirmReplace(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm('Cambiar el tipo cargará su plantilla y reemplazará los ejercicios actuales. ¿Continuar?')) onConfirm();
    return;
  }
  Alert.alert('Cambiar tipo de sesión', 'Se cargará la plantilla del nuevo tipo y se reemplazarán los ejercicios actuales.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cambiar', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function EditDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { colors } = useTheme();
  const { days, save } = usePlan();

  const original = days.find((d) => d.day === day);
  const [form, setForm] = useState<DayPlan | null>(
    original ? { ...original, exercises: [...(original.exercises ?? [])] } : null,
  );
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof DayPlan>(key: K, value: DayPlan[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const applyType = useCallback((type: SessionType) => {
    setForm((f) => {
      if (!f || f.sessionType === type) return f;
      const def = SESSION_DEFAULTS[type];
      return {
        ...f, sessionType: type, title: def.title, duration: def.duration,
        description: def.description, warmup: def.warmup, cooldown: def.cooldown, notes: def.notes,
        exercises: def.exercises.map((ex, i) => ({ ...ex, id: `${f.day}-${Date.now()}-${i}` })),
      };
    });
    setExpandedId(null);
  }, []);

  const requestType = useCallback((type: SessionType) => {
    if (!form || form.sessionType === type) return;
    const hasEdits = (form.exercises ?? []).length > 0;
    if (hasEdits) confirmReplace(() => applyType(type));
    else applyType(type);
  }, [form, applyType]);

  const changeSport = useCallback((sportKey: EditorSport) => {
    const def = EDITOR_SPORTS.find((sp) => sp.key === sportKey);
    if (def) requestType(def.types[0]);
  }, [requestType]);

  const updateExercise = useCallback((id: string, patch: Partial<ExerciseTemplate>) => {
    setForm((f) => f && ({
      ...f,
      exercises: (f.exercises ?? []).map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)),
    }));
  }, []);

  const addExercise = useCallback(() => {
    const newId = `${form?.day}-${Date.now()}`;
    setForm((f) => f && ({ ...f, exercises: [...(f.exercises ?? []), { id: newId, name: '' }] }));
    setExpandedId(newId);
  }, [form?.day]);

  const removeExercise = useCallback((id: string) => {
    setForm((f) => f && ({ ...f, exercises: (f.exercises ?? []).filter((ex) => ex.id !== id) }));
  }, []);

  const moveExercise = useCallback((id: string, dir: -1 | 1) => {
    setForm((f) => {
      if (!f) return f;
      const list = [...(f.exercises ?? [])];
      const i = list.findIndex((ex) => ex.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return f;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...f, exercises: list };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    const cleaned: DayPlan = {
      ...form,
      exercises: (form.exercises ?? []).filter((ex) => ex.name.trim().length > 0),
    };
    const next = days.map((d) => (d.day === cleaned.day ? cleaned : d));
    const err = await save(next);
    setSaving(false);
    if (err) { Alert.alert('Error al guardar', err); return; }
    tapSuccess();
    router.back();
  }, [form, days, save]);

  if (!form) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.center}>
          <Text style={[s.empty, { color: colors.text3 }]}>Día no encontrado</Text>
          <Button label="Volver" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const sport = editorSportOf(form.sessionType);
  const sportDef = EDITOR_SPORTS.find((sp) => sp.key === sport);
  const accent = SessionColors[form.sessionType] ?? colors.accent;
  const totals = sessionTotals(form.exercises ?? [], sport);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[s.dayName, { color: colors.text3 }]}>{form.dayName.toUpperCase()}</Text>

        <Input label="Título" value={form.title} onChangeText={(v) => setField('title', v)} placeholder="Nombre de la sesión" />

        <View>
          <Text style={[s.label, { color: colors.text3 }]}>DEPORTE</Text>
          <SportSegment sport={sport} onChange={changeSport} />
        </View>

        <VariantDropdown options={sportDef?.types ?? []} value={form.sessionType} onChange={requestType} />

        <Input
          label="Duración (min)"
          value={String(form.duration ?? '')}
          onChangeText={(v) => setField('duration', Number(v.replace(/[^0-9]/g, '')) || 0)}
          keyboardType="number-pad"
          placeholder="60"
        />
        <Input label="Descripción" value={form.description} onChangeText={(v) => setField('description', v)} multiline placeholder="Breve descripción de la sesión" />
        <Input label="Calentamiento" value={form.warmup ?? ''} onChangeText={(v) => setField('warmup', v)} multiline placeholder="Opcional" />
        <Input label="Enfriamiento" value={form.cooldown ?? ''} onChangeText={(v) => setField('cooldown', v)} multiline placeholder="Opcional" />
        <Input label="Notas del coach" value={form.notes ?? ''} onChangeText={(v) => setField('notes', v)} multiline placeholder="Opcional" />

        <View style={s.exHeader}>
          <Text style={[s.label, { color: colors.text3 }]}>
            {sport === 'swim' || sport === 'run' ? 'BLOQUES' : 'EJERCICIOS'} ({form.exercises?.length ?? 0})
          </Text>
          {!!totals && <Text style={[s.totals, { color: accent }]}>{totals}</Text>}
        </View>

        {(form.exercises ?? []).map((ex, i) => (
          <ExerciseAccordion
            key={ex.id}
            exercise={ex}
            index={i}
            total={form.exercises?.length ?? 0}
            sport={sport}
            accent={accent}
            expanded={expandedId === ex.id}
            onToggle={() => setExpandedId((cur) => (cur === ex.id ? null : ex.id))}
            onChange={(patch) => updateExercise(ex.id, patch)}
            onRemove={() => removeExercise(ex.id)}
            onMove={(dir) => moveExercise(ex.id, dir)}
          />
        ))}

        <Button label="+ Añadir ejercicio" variant="secondary" fullWidth onPress={addExercise} style={s.addBtn} />
        <Button
          label={saving ? 'Guardando...' : 'Guardar cambios'}
          onPress={handleSave}
          disabled={saving}
          fullWidth
          style={[s.saveBtn, { backgroundColor: accent }]}
          textStyle={{ color: '#fff' }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.base },
  empty: { fontSize: FontSize.body },
  dayName: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65, marginBottom: Spacing.gapXs },
  exHeader: { marginTop: Spacing.gapSm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totals: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  addBtn: { marginTop: Spacing.gapSm },
  saveBtn: { marginTop: Spacing.gapSm },
});
```

- [ ] **Step 2: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores, tests verdes

- [ ] **Step 3: Verificación manual (web)**

Run: `npm run web`, abre el editor del martes (Semana → Martes → editar):
- Segmentado marca 🏊 Swim; NO aparece campo «Carga» en los bloques.
- Los bloques colapsados muestran resumen («8×100m · desc 30s»); solo uno se abre a la vez.
- Chips de descanso rellenan el campo, y escribir «22s» a mano lo deselecciona.
- Cambiar a Gym pide confirmación y carga plantilla con campo Carga.
- Cabecera muestra «X m totales» en swim.
- Guardar persiste y vuelve atrás.

- [ ] **Step 4: Commit**

```bash
git add app/plan/\[day\].tsx
git commit -m "feat: editor de sesión adaptativo por deporte con acordeón"
```

---
### Task 8: Tabla `events` + tipos TS

**Files:**
- Create: `supabase/migrations/2026-07-07-events.sql`
- Modify: `supabase/schema.sql` (añadir al final)
- Modify: `types/index.ts` (añadir al final)

- [ ] **Step 1: Migración SQL** (mismo contenido en ambos archivos SQL; sigue el estilo de policies existente)

```sql
-- supabase/migrations/2026-07-07-events.sql
-- Eventos del calendario: carreras (kind='race') y eventos personales (kind='event').
-- Los entrenamientos NO viven aquí; solo lo que el usuario añade a mano.
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  date date not null,
  end_date date,
  kind text not null check (kind in ('race', 'event')),
  icon text,
  notes text,
  race jsonb,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Users can view own events"
  on public.events for select using (auth.uid() = user_id);

create policy "Users can insert own events"
  on public.events for insert with check (auth.uid() = user_id);

create policy "Users can update own events"
  on public.events for update using (auth.uid() = user_id);

create policy "Users can delete own events"
  on public.events for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Ejecutar la migración en Supabase**

Pide al usuario ejecutar el SQL en el editor de Supabase (no hay CLI conectada), o hazlo tú si hay MCP/acceso. No continúes a la Task 13 sin la tabla creada; las Tasks 9-12 son lógica pura y no la necesitan.

- [ ] **Step 3: Tipos TS** (al final de `types/index.ts`)

```ts
// ─── Agenda: eventos y carreras ──────────────────────────────────────────────

export interface RaceDetails {
  distance_km: number;
  target_time?: string;   // "1:29:59" — parsing en lib/agenda/time.ts
  result_time?: string;
  position?: number;
  feelings?: string;
  ai_analysis?: string;
  is_goal?: boolean;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  date: string;           // ISO yyyy-mm-dd
  end_date?: string | null;
  kind: 'race' | 'event';
  icon?: string | null;
  notes?: string | null;
  race?: RaceDetails | null;
  created_at?: string;
}
```

- [ ] **Step 4: Typecheck y commit**

Run: `npx tsc --noEmit` → sin errores

```bash
git add supabase/migrations/2026-07-07-events.sql supabase/schema.sql types/index.ts
git commit -m "feat: tabla events con RLS y tipos CalendarEvent/RaceDetails"
```

---

### Task 9: Tiempos y ritmo (`lib/agenda/time.ts`)

**Files:**
- Create: `lib/agenda/time.ts`
- Test: `tests/agenda/time.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/agenda/time.test.ts
import { describe, it, expect } from 'vitest';
import { parseClock, formatClock, paceMinKm } from '../../lib/agenda/time';

describe('parseClock', () => {
  it('parsea h:mm:ss y mm:ss a segundos', () => {
    expect(parseClock('1:29:59')).toBe(5399);
    expect(parseClock('41:32')).toBe(2492);
  });
  it('devuelve null si es inválido', () => {
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('1:75:00')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});

describe('formatClock', () => {
  it('formatea con y sin horas', () => {
    expect(formatClock(5399)).toBe('1:29:59');
    expect(formatClock(2492)).toBe('41:32');
  });
});

describe('paceMinKm', () => {
  it('deriva el ritmo min/km', () => {
    expect(paceMinKm(5399, 21.1)).toBe('4:16');
    expect(paceMinKm(2492, 10)).toBe('4:09');
  });
  it('null con distancia 0', () => {
    expect(paceMinKm(2492, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agenda/time.test.ts` → FAIL, módulo inexistente

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/agenda/time.ts

// "1:29:59" o "41:32" → segundos; null si no cuadra.
export function parseClock(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hasHours = m[3] !== undefined;
  const h = hasHours ? Number(m[1]) : 0;
  const min = hasHours ? Number(m[2]) : Number(m[1]);
  const sec = hasHours ? Number(m[3]) : Number(m[2]);
  if (min > 59 || sec > 59) return null;
  return h * 3600 + min * 60 + sec;
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  const mm = h > 0 ? String(min).padStart(2, '0') : String(min);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

// Ritmo redondeado al segundo: "4:16" min/km.
export function paceMinKm(totalSeconds: number, distanceKm: number): string | null {
  if (distanceKm <= 0) return null;
  const secPerKm = Math.round(totalSeconds / distanceKm);
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agenda/time.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add lib/agenda/time.ts tests/agenda/time.test.ts
git commit -m "feat: parseo de tiempos de carrera y ritmo derivado"
```

---

### Task 10: Fases hacia atrás desde la carrera (`lib/agenda/phases.ts`)

**Files:**
- Create: `lib/agenda/phases.ts`
- Test: `tests/agenda/phases.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/agenda/phases.test.ts
import { describe, it, expect } from 'vitest';
import { computePhases, phaseAt, compliancePct } from '../../lib/agenda/phases';

// Carrera 2026-10-25 (domingo). Su semana (lunes) empieza el 2026-10-19.
// Race: 19 oct. Taper: 2 sem antes (5 oct). Peak: 4 sem antes (7 sep). Build: 4 sem antes (10 ago).
describe('computePhases', () => {
  const phases = computePhases('2026-06-08', '2026-10-25');

  it('ancla cada fase hacia atrás desde la semana de carrera', () => {
    expect(phases.map((p) => [p.phase, p.start])).toEqual([
      ['base', '2026-06-08'],
      ['build', '2026-08-10'],
      ['peak', '2026-09-07'],
      ['taper', '2026-10-05'],
      ['race', '2026-10-19'],
    ]);
  });

  it('si el plan empieza tarde, recorta base (nunca fases negativas)', () => {
    const short = computePhases('2026-09-20', '2026-10-25');
    expect(short.find((p) => p.phase === 'base')).toBeUndefined();
    expect(short[0].start).toBe('2026-09-20');
  });
});

describe('phaseAt', () => {
  const phases = computePhases('2026-06-08', '2026-10-25');
  it('devuelve la fase de una fecha', () => {
    expect(phaseAt(phases, '2026-07-07')).toBe('base');
    expect(phaseAt(phases, '2026-10-24')).toBe('race');
  });
  it('null fuera de rango (carrera pasada)', () => {
    expect(phaseAt(phases, '2026-11-01')).toBeNull();
  });
});

describe('compliancePct', () => {
  it('completadas / planificadas, sin pasar de 100', () => {
    expect(compliancePct(6, 7)).toBe(86);
    expect(compliancePct(9, 7)).toBe(100);
    expect(compliancePct(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/agenda/phases.test.ts` → FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/agenda/phases.ts
import type { TrainingPhase } from '../../types';

export interface PhaseRange {
  phase: TrainingPhase;
  start: string; // ISO, lunes de inicio
  end: string;   // ISO, domingo final (inclusive)
}

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().split('T')[0];
const at = (s: string) => new Date(`${s}T00:00:00Z`);

function mondayOfWeek(d: Date): Date {
  const shift = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - shift * DAY_MS);
}

// Duración estándar hacia atrás desde la semana de carrera: taper 2, peak 4, build 4.
// Base ocupa lo que quede hasta start_date; si no queda hueco, la fase se omite.
const BACKWARD: Array<{ phase: TrainingPhase; weeks: number }> = [
  { phase: 'race', weeks: 1 },
  { phase: 'taper', weeks: 2 },
  { phase: 'peak', weeks: 4 },
  { phase: 'build', weeks: 4 },
];

export function computePhases(startDate: string, raceDate: string): PhaseRange[] {
  const start = at(startDate);
  const raceMonday = mondayOfWeek(at(raceDate));
  const ranges: PhaseRange[] = [];
  let cursor = new Date(raceMonday.getTime() + 7 * DAY_MS); // exclusivo

  for (const { phase, weeks } of BACKWARD) {
    const phaseStart = new Date(cursor.getTime() - weeks * 7 * DAY_MS);
    const clampedStart = phaseStart < start ? start : phaseStart;
    if (clampedStart < cursor) {
      ranges.unshift({ phase, start: iso(clampedStart), end: iso(new Date(cursor.getTime() - DAY_MS)) });
    }
    cursor = phaseStart;
    if (cursor <= start) break;
  }

  if (start < cursor) {
    ranges.unshift({ phase: 'base', start: iso(start), end: iso(new Date(cursor.getTime() - DAY_MS)) });
  }
  return ranges;
}

export function phaseAt(phases: PhaseRange[], date: string): TrainingPhase | null {
  const hit = phases.find((p) => date >= p.start && date <= p.end);
  return hit?.phase ?? null;
}

export function compliancePct(completed: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.min(100, Math.round((completed / planned) * 100));
}
```

- [ ] **Step 4: Run** `npx vitest run tests/agenda/phases.test.ts` → PASS. Si el test de anclas falla por un día, revisa `mondayOfWeek` con UTC (el test usa fechas UTC a medianoche; no uses `getDay()` local).

- [ ] **Step 5: Commit**

```bash
git add lib/agenda/phases.ts tests/agenda/phases.test.ts
git commit -m "feat: fases del plan calculadas hacia atrás desde la carrera"
```

---

### Task 11: Detección de PB (`lib/agenda/pb.ts`)

**Files:**
- Create: `lib/agenda/pb.ts`
- Test: `tests/agenda/pb.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/agenda/pb.test.ts
import { describe, it, expect } from 'vitest';
import { isPersonalBest } from '../../lib/agenda/pb';
import type { CalendarEvent } from '../../types';

const race = (distance_km: number, result_time?: string): CalendarEvent => ({
  id: 'r', user_id: 'u', title: 'x', date: '2026-01-01', kind: 'race',
  race: { distance_km, result_time },
});

describe('isPersonalBest', () => {
  const history = [race(10, '43:58'), race(10, '41:32'), race(21.1, '1:35:00'), race(10)];

  it('PB si mejora el mejor tiempo previo en esa distancia', () => {
    expect(isPersonalBest(10, '41:00', history)).toBe(true);
    expect(isPersonalBest(10, '42:00', history)).toBe(false);
  });
  it('empate no es PB', () => {
    expect(isPersonalBest(10, '41:32', history)).toBe(false);
  });
  it('primera carrera en la distancia es PB', () => {
    expect(isPersonalBest(5, '20:00', history)).toBe(true);
  });
  it('tolera ±0.1 km al agrupar distancia', () => {
    expect(isPersonalBest(21.0975, '1:29:59', history)).toBe(true);
    expect(isPersonalBest(21.0975, '1:36:00', history)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/agenda/pb.test.ts` → FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/agenda/pb.ts
import type { CalendarEvent } from '../../types';
import { parseClock } from './time';

// PB = estrictamente mejor que todo resultado previo en la misma distancia (±0.1 km).
export function isPersonalBest(distanceKm: number, resultTime: string, history: CalendarEvent[]): boolean {
  const seconds = parseClock(resultTime);
  if (seconds === null) return false;

  const previous = history
    .filter((e) => e.kind === 'race' && e.race?.result_time && Math.abs(e.race.distance_km - distanceKm) <= 0.1)
    .map((e) => parseClock(e.race!.result_time!))
    .filter((s): s is number => s !== null);

  return previous.every((prev) => seconds < prev);
}
```

- [ ] **Step 4: Run** `npx vitest run tests/agenda/pb.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add lib/agenda/pb.ts tests/agenda/pb.test.ts
git commit -m "feat: detección de PB por distancia"
```

---

### Task 12: Grid mensual (`lib/agenda/month.ts`)

**Files:**
- Create: `lib/agenda/month.ts`
- Test: `tests/agenda/month.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/agenda/month.test.ts
import { describe, it, expect } from 'vitest';
import { monthGrid, monthLabel } from '../../lib/agenda/month';

describe('monthGrid', () => {
  // Julio 2026: miércoles 1 → la primera semana empieza en lunes 29 de junio.
  const grid = monthGrid(2026, 6);

  it('empieza en lunes y las semanas son de 7', () => {
    expect(grid[0][0].iso).toBe('2026-06-29');
    expect(grid[0][0].inMonth).toBe(false);
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
  it('contiene todos los días del mes marcados inMonth', () => {
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].iso).toBe('2026-07-01');
    expect(inMonth[30].iso).toBe('2026-07-31');
  });
});

describe('monthLabel', () => {
  it('etiqueta en español', () => {
    expect(monthLabel(2026, 6).toLowerCase()).toContain('julio');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/agenda/month.test.ts` → FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/agenda/month.ts

export interface MonthCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().split('T')[0];

// month es 0-index (6 = julio). Semanas lunes→domingo cubriendo el mes completo.
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY_MS);
  const weeks: MonthCell[][] = [];
  let cursor = start;

  while (cursor.getUTCMonth() === month || weeks.length === 0 || cursor <= new Date(Date.UTC(year, month + 1, 0))) {
    const week: MonthCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ iso: iso(cursor), day: cursor.getUTCDate(), inMonth: cursor.getUTCMonth() === month });
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    weeks.push(week);
    if (cursor.getUTCMonth() !== month) break;
  }
  return weeks;
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('es-ES', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
```

- [ ] **Step 4: Run** `npx vitest run tests/agenda/month.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add lib/agenda/month.ts tests/agenda/month.test.ts
git commit -m "feat: grid mensual lunes-domingo para el calendario"
```

---

### Task 13: Hook de eventos (`hooks/useEvents.ts`)

**Files:**
- Create: `hooks/useEvents.ts`

- [ ] **Step 1: Hook CRUD** (patrón de `hooks/useTraining.ts`: refetch + estado local)

```ts
// hooks/useEvents.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarEvent } from '../types';

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error: err } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (err) setError(err.message);
    else setEvents((data ?? []) as CalendarEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // Devuelve el id creado para poder encadenar setGoalRace sin releer estado stale.
  const addEvent = useCallback(async (ev: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at'>): Promise<{ id: string | null; error: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null, error: 'No hay sesión activa' };
    const { data, error: err } = await supabase
      .from('events')
      .insert({ ...ev, user_id: user.id })
      .select('id')
      .single();
    if (err) return { id: null, error: err.message };
    await refetch();
    return { id: data.id as string, error: null };
  }, [refetch]);

  const updateEvent = useCallback(async (id: string, patch: Partial<CalendarEvent>): Promise<string | null> => {
    const { error: err } = await supabase.from('events').update(patch).eq('id', id);
    if (err) return err.message;
    await refetch();
    return null;
  }, [refetch]);

  const removeEvent = useCallback(async (id: string): Promise<string | null> => {
    const { error: err } = await supabase.from('events').delete().eq('id', id);
    if (err) return err.message;
    await refetch();
    return null;
  }, [refetch]);

  // Solo una carrera objetivo: desmarca las demás y sincroniza goal_race_date del plan.
  // Lee de la BD (no del estado) para funcionar justo después de un addEvent.
  const setGoalRace = useCallback(async (id: string): Promise<string | null> => {
    const { data: target, error: readErr } = await supabase
      .from('events').select('*').eq('id', id).maybeSingle();
    if (readErr || !target || !(target as CalendarEvent).race) return readErr?.message ?? 'La carrera no existe';
    const targetEvent = target as CalendarEvent;

    const { data: others } = await supabase
      .from('events').select('*').eq('kind', 'race').neq('id', id);
    for (const e of (others ?? []) as CalendarEvent[]) {
      if (e.race?.is_goal) {
        const err = (await supabase.from('events').update({ race: { ...e.race, is_goal: false } }).eq('id', e.id)).error;
        if (err) return err.message;
      }
    }
    const { error: err } = await supabase
      .from('events').update({ race: { ...targetEvent.race!, is_goal: true } }).eq('id', id);
    if (err) return err.message;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('training_plans').update({ goal_race_date: targetEvent.date }).eq('user_id', user.id);
    }
    await refetch();
    return null;
  }, [refetch]);

  return { events, loading, error, refetch, addEvent, updateEvent, removeEvent, setGoalRace };
}
```

- [ ] **Step 2: Typecheck y commit**

Run: `npx tsc --noEmit` → sin errores

```bash
git add hooks/useEvents.ts
git commit -m "feat: hook useEvents con CRUD y carrera objetivo única"
```

---
### Task 14: RaceHeroCard (cuenta atrás + fases)

**Files:**
- Create: `components/agenda/RaceHeroCard.tsx`

- [ ] **Step 1: Componente**

```tsx
// components/agenda/RaceHeroCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, TrainingPhase } from '../../types';
import { PhaseRange, phaseAt } from '../../lib/agenda/phases';
import { parseClock, paceMinKm } from '../../lib/agenda/time';

const PHASE_LABELS: Record<TrainingPhase, string> = {
  base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper', race: 'Race', hyrox_prep: 'Hyrox',
};
const PHASE_COLORS: Record<TrainingPhase, string> = {
  base: '#30d158', build: '#0a84ff', peak: '#bf5af2', taper: '#ff9f0a', race: '#ff375f', hyrox_prep: '#ff6b35',
};

interface RaceHeroCardProps {
  race: CalendarEvent;          // kind='race' con race details
  phases: PhaseRange[];
  compliance: number;           // 0-100
}

export function RaceHeroCard({ race, phases, compliance }: RaceHeroCardProps) {
  const { colors } = useTheme();
  const details = race.race!;
  const today = new Date().toISOString().split('T')[0];
  const daysLeft = Math.max(0, Math.ceil((new Date(`${race.date}T00:00:00`).getTime() - Date.now()) / 86_400_000));
  const currentPhase = phaseAt(phases, today);
  const targetSeconds = details.target_time ? parseClock(details.target_time) : null;
  const pace = targetSeconds !== null ? paceMinKm(targetSeconds, details.distance_km) : null;
  const dateLabel = new Date(`${race.date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const totalDays = phases.length
    ? (new Date(`${phases[phases.length - 1].end}T00:00:00`).getTime() - new Date(`${phases[0].start}T00:00:00`).getTime()) / 86_400_000
    : 0;

  return (
    <LinearGradient colors={['#2a0a14', '#45102a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
      <Text style={s.tag}>
        CARRERA OBJETIVO{currentPhase ? ` · FASE ${PHASE_LABELS[currentPhase].toUpperCase()}` : ''}
      </Text>
      <Text style={s.name}>{race.title}</Text>
      <Text style={s.meta}>
        {dateLabel} · {details.distance_km.toLocaleString('es-ES')} km
        {details.target_time ? ` · objetivo ${details.target_time}${pace ? ` (${pace}/km)` : ''}` : ''}
      </Text>

      <View style={s.counters}>
        <View style={s.counter}>
          <Animated.Text key={daysLeft} entering={FadeInDown.duration(300)} style={s.counterValue}>{daysLeft}</Animated.Text>
          <Text style={s.counterLabel}>DÍAS</Text>
        </View>
        <View style={s.counter}>
          <Text style={s.counterValue}>{Math.floor(daysLeft / 7)}</Text>
          <Text style={s.counterLabel}>SEMANAS</Text>
        </View>
        <View style={s.counter}>
          <Text style={s.counterValue}>{compliance}%</Text>
          <Text style={s.counterLabel}>PLAN CUMPLIDO</Text>
        </View>
      </View>

      {phases.length > 0 && totalDays > 0 && (
        <View>
          <View style={s.phaseBar}>
            {phases.map((p) => {
              const days = (new Date(`${p.end}T00:00:00`).getTime() - new Date(`${p.start}T00:00:00`).getTime()) / 86_400_000 + 1;
              const active = p.phase === currentPhase;
              return (
                <View
                  key={p.phase}
                  style={{ flex: days, backgroundColor: active ? PHASE_COLORS[p.phase] : 'rgba(255,255,255,0.14)' }}
                />
              );
            })}
          </View>
          <View style={s.phaseLabels}>
            {phases.map((p) => (
              <Text key={p.phase} style={[s.phaseLabel, p.phase === currentPhase && { color: PHASE_COLORS[p.phase] }]}>
                {PHASE_LABELS[p.phase]}
              </Text>
            ))}
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.cardPadding, gap: Spacing.gapXs },
  tag: { color: '#ff375f', fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: 1 },
  name: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.black },
  meta: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.base },
  counters: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.gapSm },
  counter: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  counterValue: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.black, fontVariant: ['tabular-nums'] },
  counterLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: FontWeight.heavy, letterSpacing: 0.5 },
  phaseBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.gapSm },
  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  phaseLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: FontWeight.heavy },
});
```

El gradiente rojo racing es fijo a propósito (identidad de la tarjeta en los 3 temas), igual que `SessionColors`.

- [ ] **Step 2: Typecheck y commit**

Run: `npx tsc --noEmit` → sin errores

```bash
git add components/agenda/RaceHeroCard.tsx
git commit -m "feat: tarjeta hero de carrera con cuenta atrás y fases"
```

---

### Task 15: EventsCalendar (mes, solo eventos manuales)

**Files:**
- Create: `components/agenda/EventsCalendar.tsx`

- [ ] **Step 1: Componente**

```tsx
// components/agenda/EventsCalendar.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent } from '../../types';
import { monthGrid, monthLabel, MonthCell } from '../../lib/agenda/month';
import { tapLight } from '../../lib/haptics';

interface EventsCalendarProps {
  events: CalendarEvent[];
  onDayPress: (iso: string, dayEvents: CalendarEvent[]) => void;
}

function eventsOn(events: CalendarEvent[], iso: string): CalendarEvent[] {
  return events.filter((e) => iso >= e.date && iso <= (e.end_date ?? e.date));
}

export function EventsCalendar({ events, onDayPress }: EventsCalendarProps) {
  const { colors } = useTheme();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const todayIso = now.toISOString().split('T')[0];

  const shift = (delta: number) => {
    tapLight();
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const grid = monthGrid(cursor.year, cursor.month);

  const renderCell = (cell: MonthCell) => {
    const dayEvents = eventsOn(events, cell.iso);
    const hasRace = dayEvents.some((e) => e.kind === 'race');
    const hasEvent = dayEvents.some((e) => e.kind === 'event');
    const isToday = cell.iso === todayIso;

    return (
      <TouchableOpacity
        key={cell.iso}
        style={[
          s.cell,
          isToday && { backgroundColor: colors.accent },
          !isToday && hasRace && s.raceCell,
          !isToday && !hasRace && hasEvent && s.eventCell,
        ]}
        onPress={() => onDayPress(cell.iso, dayEvents)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            s.cellText,
            { color: cell.inMonth ? colors.text : colors.text3 },
            isToday && { color: '#fff', fontWeight: FontWeight.black },
            !isToday && hasRace && { color: '#ff375f', fontWeight: FontWeight.black },
          ]}
        >
          {cell.day}
        </Text>
        <Text style={s.cellIcon}>
          {hasRace ? '🏁' : hasEvent ? (dayEvents.find((e) => e.kind === 'event')?.icon ?? '📌') : ' '}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.card, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>{monthLabel(cursor.year, cursor.month)}</Text>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={s.dowRow}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
          <Text key={`${d}${i}`} style={[s.dow, { color: colors.text3 }]}>{d}</Text>
        ))}
      </View>

      <Animated.View key={`${cursor.year}-${cursor.month}`} entering={FadeIn.duration(200)}>
        {grid.map((week) => (
          <View key={week[0].iso} style={s.weekRow}>{week.map(renderCell)}</View>
        ))}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xs, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.black, textTransform: 'capitalize' },
  dowRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  dow: { flex: 1, textAlign: 'center', fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: Radius.sm, margin: 1 },
  raceCell: { backgroundColor: 'rgba(255,55,95,0.14)', borderWidth: 1, borderColor: '#ff375f' },
  eventCell: { backgroundColor: 'rgba(255,159,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.45)' },
  cellText: { fontSize: FontSize.base, fontVariant: ['tabular-nums'] },
  cellIcon: { fontSize: 8, lineHeight: 10 },
});
```

- [ ] **Step 2: Typecheck y commit**

```bash
npx tsc --noEmit
git add components/agenda/EventsCalendar.tsx
git commit -m "feat: calendario mensual solo con eventos manuales"
```

---

### Task 16: EventRow y EventModal

**Files:**
- Create: `components/agenda/EventRow.tsx`
- Create: `components/agenda/EventModal.tsx`

- [ ] **Step 1: EventRow**

```tsx
// components/agenda/EventRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent } from '../../types';
import { paceMinKm, parseClock } from '../../lib/agenda/time';
import { PressableScale } from '../ui/PressableScale';

interface EventRowProps {
  event: CalendarEvent;
  onPress: () => void;
}

export function EventRow({ event, onPress }: EventRowProps) {
  const { colors } = useTheme();
  const isRace = event.kind === 'race';
  const result = event.race?.result_time;
  const daysLeft = Math.ceil((new Date(`${event.date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const resultSeconds = result ? parseClock(result) : null;
  const pace = resultSeconds !== null && event.race ? paceMinKm(resultSeconds, event.race.distance_km) : null;

  const pill = result
    ? { text: pace ? `${pace}/km` : result, bg: colors.accentSoft, color: colors.accent }
    : isRace
      ? { text: `${Math.max(0, daysLeft)} D`, bg: 'rgba(255,55,95,0.14)', color: '#ff375f' }
      : { text: 'EVENTO', bg: 'rgba(255,159,10,0.14)', color: '#ff9f0a' };

  return (
    <PressableScale style={[s.row, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]} onPress={onPress}>
      <View style={s.left}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
          {isRace ? '🏁 ' : `${event.icon ?? '📌'} `}{event.title}
        </Text>
        <Text style={[s.meta, { color: colors.text3 }]} numberOfLines={1}>
          {dateLabel}
          {event.race?.target_time && !result ? ` · objetivo ${event.race.target_time}` : ''}
          {result ? ` · ${result}` : ''}
          {event.race?.ai_analysis ? ' · análisis del coach' : ''}
        </Text>
      </View>
      <View style={[s.pill, { backgroundColor: pill.bg }]}>
        <Text style={[s.pillText, { color: pill.color }]}>{pill.text}</Text>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.gapSm },
  left: { flex: 1 },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  meta: { fontSize: FontSize.base, marginTop: 2 },
  pill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 3 },
  pillText: { fontSize: FontSize.sm, fontWeight: FontWeight.black },
});
```

- [ ] **Step 2: EventModal** (alta/edición; tipo Evento/Carrera; validación antes de guardar)

```tsx
// components/agenda/EventModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, RaceDetails } from '../../types';
import { parseClock } from '../../lib/agenda/time';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PresetChips } from '../training/PresetChips';
import { tapSuccess } from '../../lib/haptics';

const ICONS = ['📌', '✈️', '🩺', '🎂', '💼', '🏖️', '⛰️', '🎉'];
const DISTANCES = ['5', '10', '21.1', '42.2'];

export type EventDraft = Omit<CalendarEvent, 'id' | 'user_id' | 'created_at'>;

interface EventModalProps {
  visible: boolean;
  initialDate: string;
  editing: CalendarEvent | null;      // null = alta
  onClose: () => void;
  onSave: (draft: EventDraft, id?: string) => Promise<string | null>;
  onDelete?: (id: string) => Promise<string | null>;
}

export function EventModal({ visible, initialDate, editing, onClose, onSave, onDelete }: EventModalProps) {
  const { colors } = useTheme();
  const [kind, setKind] = useState<'event' | 'race'>('event');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [endDate, setEndDate] = useState('');
  const [icon, setIcon] = useState('📌');
  const [notes, setNotes] = useState('');
  const [distance, setDistance] = useState('');
  const [target, setTarget] = useState('');
  const [isGoal, setIsGoal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setKind(editing?.kind ?? 'event');
    setTitle(editing?.title ?? '');
    setDate(editing?.date ?? initialDate);
    setEndDate(editing?.end_date ?? '');
    setIcon(editing?.icon ?? '📌');
    setNotes(editing?.notes ?? '');
    setDistance(editing?.race ? String(editing.race.distance_km) : '');
    setTarget(editing?.race?.target_time ?? '');
    setIsGoal(editing?.race?.is_goal ?? false);
  }, [visible, editing, initialDate]);

  const validate = (): string | null => {
    if (!title.trim()) return 'Pon un título';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Fecha en formato AAAA-MM-DD';
    if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < date)) return 'Fecha fin inválida';
    if (kind === 'race') {
      const km = parseFloat(distance.replace(',', '.'));
      if (!km || km <= 0) return 'Distancia en km (p. ej. 21.1)';
      if (target && parseClock(target) === null) return 'Objetivo como 1:29:59 o 41:32';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Revisa el evento', err); return; }
    setSaving(true);
    const race: RaceDetails | null = kind === 'race'
      ? {
          ...(editing?.race ?? {}),
          distance_km: parseFloat(distance.replace(',', '.')),
          target_time: target || undefined,
          is_goal: isGoal,
        }
      : null;
    const draft: EventDraft = {
      title: title.trim(), date, end_date: endDate || null, kind,
      icon: kind === 'event' ? icon : null, notes: notes || null, race,
    };
    const saveErr = await onSave(draft, editing?.id);
    setSaving(false);
    if (saveErr) { Alert.alert('Error al guardar', saveErr); return; }
    tapSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: colors.text }]}>{editing ? 'Editar' : 'Nuevo'} evento</Text>

            <View style={[s.kindTrack, { backgroundColor: colors.glassBg, borderColor: colors.border }]}>
              {(['event', 'race'] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[s.kindSegment, kind === k && { backgroundColor: k === 'race' ? '#ff375f' : colors.accent }]}
                  onPress={() => setKind(k)}
                >
                  <Text style={[s.kindText, { color: kind === k ? '#fff' : colors.text3 }]}>
                    {k === 'race' ? '🏁 Carrera' : '📌 Evento'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Título" value={title} onChangeText={setTitle} placeholder={kind === 'race' ? 'Media Maratón Valencia' : 'Viaje a Berlín'} />
            <Input label="Fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-10-25" />
            <Input label="Fecha fin (opcional)" value={endDate} onChangeText={setEndDate} placeholder="Para eventos de varios días" />

            {kind === 'event' && (
              <View>
                <Input label="Icono" value={icon} onChangeText={setIcon} placeholder="📌" />
                <PresetChips presets={ICONS} value={icon} onSelect={setIcon} accent={colors.accent} />
              </View>
            )}

            {kind === 'race' && (
              <>
                <View>
                  <Input label="Distancia (km)" value={distance} onChangeText={setDistance} placeholder="21.1" keyboardType="decimal-pad" />
                  <PresetChips presets={DISTANCES} value={distance} onSelect={setDistance} accent="#ff375f" />
                </View>
                <Input label="Tiempo objetivo (opcional)" value={target} onChangeText={setTarget} placeholder="1:29:59" />
                <TouchableOpacity style={s.goalRow} onPress={() => setIsGoal((g) => !g)} activeOpacity={0.75}>
                  <Text style={[s.goalText, { color: colors.text }]}>Carrera objetivo del plan</Text>
                  <Text style={{ fontSize: FontSize.lg }}>{isGoal ? '✅' : '⬜️'}</Text>
                </TouchableOpacity>
              </>
            )}

            <Input label="Notas" value={notes} onChangeText={setNotes} multiline placeholder="Opcional" />

            <Button label={saving ? 'Guardando...' : 'Guardar'} onPress={handleSave} disabled={saving} fullWidth />
            {editing && onDelete && (
              <Button
                label="Eliminar evento"
                variant="danger"
                fullWidth
                onPress={async () => {
                  const err = await onDelete(editing.id);
                  if (err) Alert.alert('Error', err); else onClose();
                }}
              />
            )}
            <Button label="Cancelar" variant="ghost" fullWidth onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, borderWidth: 1, maxHeight: '88%' },
  content: { padding: Spacing.lg, gap: Spacing.base, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  kindTrack: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: 3, gap: 2 },
  kindSegment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  kindText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  goalText: { fontSize: FontSize.md, fontWeight: FontWeight.label },
});
```

Al guardar con `is_goal: true`, la pantalla Agenda (Task 18) llama después a `setGoalRace` para desmarcar las demás y sincronizar `goal_race_date`.

- [ ] **Step 3: Typecheck y commit**

```bash
npx tsc --noEmit
git add components/agenda/EventRow.tsx components/agenda/EventModal.tsx
git commit -m "feat: fila y modal de alta/edición de eventos y carreras"
```

---

### Task 17: ResultModal (resultado + PB + análisis del coach)

**Files:**
- Create: `components/agenda/ResultModal.tsx`

- [ ] **Step 1: Componente**

El análisis usa `askGroq` (proxy `/api/chat` con JWT + BYOK, patrón existente). Si falla, el resultado se guarda igual y el análisis queda pendiente (no bloquea).

```tsx
// components/agenda/ResultModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, RaceDetails } from '../../types';
import { parseClock, paceMinKm } from '../../lib/agenda/time';
import { isPersonalBest } from '../../lib/agenda/pb';
import { askGroq, COACH_SYSTEM_PROMPT } from '../../lib/groq';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { tapSuccess } from '../../lib/haptics';

interface ResultModalProps {
  visible: boolean;
  race: CalendarEvent | null;
  history: CalendarEvent[];
  onClose: () => void;
  onSave: (id: string, race: RaceDetails) => Promise<string | null>;
  onPB: () => void; // dispara confeti en la pantalla
}

export function ResultModal({ visible, race, history, onClose, onSave, onPB }: ResultModalProps) {
  const { colors } = useTheme();
  const [time, setTime] = useState('');
  const [position, setPosition] = useState('');
  const [feelings, setFeelings] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTime(race?.race?.result_time ?? '');
    setPosition(race?.race?.position != null ? String(race.race.position) : '');
    setFeelings(race?.race?.feelings ?? '');
  }, [visible, race]);

  if (!race?.race) return null;
  const details = race.race;

  const handleSave = async () => {
    const seconds = parseClock(time);
    if (seconds === null) { Alert.alert('Revisa el tiempo', 'Formato 1:29:59 o 41:32'); return; }
    setSaving(true);

    const pb = isPersonalBest(details.distance_km, time, history.filter((e) => e.id !== race.id));
    const pace = paceMinKm(seconds, details.distance_km);

    let analysis: string | undefined;
    try {
      const prompt = [
        `Acabo de correr "${race.title}" (${details.distance_km} km).`,
        `Resultado: ${time}${pace ? ` (${pace}/km)` : ''}.`,
        details.target_time ? `Mi objetivo era ${details.target_time}.` : 'No tenía tiempo objetivo.',
        position ? `Posición: ${position}.` : '',
        feelings ? `Sensaciones: ${feelings}` : '',
        pb ? 'Es mi mejor marca personal en la distancia.' : '',
        'Dame un análisis breve (máx 120 palabras): valoración vs objetivo y 2-3 ajustes para la siguiente.',
      ].filter(Boolean).join(' ');
      analysis = await askGroq([{ role: 'user', content: prompt }], COACH_SYSTEM_PROMPT);
    } catch {
      analysis = undefined; // el análisis es best-effort
    }

    const err = await onSave(race.id, {
      ...details,
      result_time: time,
      position: position ? Number(position.replace(/[^0-9]/g, '')) || undefined : undefined,
      feelings: feelings || undefined,
      ai_analysis: analysis ?? details.ai_analysis,
    });
    setSaving(false);
    if (err) { Alert.alert('Error al guardar', err); return; }
    tapSuccess();
    if (pb) onPB();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: colors.text }]}>Resultado · {race.title}</Text>
            <Text style={[s.meta, { color: colors.text3 }]}>
              {details.distance_km} km{details.target_time ? ` · objetivo ${details.target_time}` : ''}
            </Text>
            <Input label="Tiempo final" value={time} onChangeText={setTime} placeholder="1:29:59" />
            <Input label="Posición (opcional)" value={position} onChangeText={setPosition} keyboardType="number-pad" placeholder="42" />
            <Input label="Sensaciones" value={feelings} onChangeText={setFeelings} multiline placeholder="¿Cómo fue? Ritmo, avituallamiento, cabeza..." />
            <Button label={saving ? 'Guardando y analizando...' : 'Guardar resultado'} onPress={handleSave} disabled={saving} fullWidth />
            <Button label="Cancelar" variant="ghost" fullWidth onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, borderWidth: 1, maxHeight: '88%' },
  content: { padding: Spacing.lg, gap: Spacing.base, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  meta: { fontSize: FontSize.base },
});
```

- [ ] **Step 2: Typecheck y commit**

```bash
npx tsc --noEmit
git add components/agenda/ResultModal.tsx
git commit -m "feat: modal de resultado con PB y análisis del coach"
```

---

### Task 18: Pantalla Agenda + tab

**Files:**
- Create: `app/(tabs)/agenda.tsx`
- Modify: `app/(tabs)/_layout.tsx` (añadir `Tabs.Screen` entre `semana` y `chat`)

- [ ] **Step 1: Pantalla**

```tsx
// app/(tabs)/agenda.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, RaceDetails } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { useSessions } from '../../hooks/useTraining';
import { usePlan } from '../../lib/PlanContext';
import { computePhases, compliancePct } from '../../lib/agenda/phases';
import { RaceHeroCard } from '../../components/agenda/RaceHeroCard';
import { EventsCalendar } from '../../components/agenda/EventsCalendar';
import { EventRow } from '../../components/agenda/EventRow';
import { EventModal, EventDraft } from '../../components/agenda/EventModal';
import { ResultModal } from '../../components/agenda/ResultModal';
import { Confetti } from '../../components/ui/Confetti';
import { PressableScale } from '../../components/ui/PressableScale';

const todayIso = () => new Date().toISOString().split('T')[0];

export default function AgendaScreen() {
  const { colors } = useTheme();
  const { events, loading, addEvent, updateEvent, removeEvent, setGoalRace } = useEvents();
  const { sessions } = useSessions(200);
  const { days } = usePlan();

  const [modalDate, setModalDate] = useState(todayIso());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [resultRace, setResultRace] = useState<CalendarEvent | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  const today = todayIso();
  const races = events.filter((e) => e.kind === 'race');
  const goalRace = races.find((e) => e.race?.is_goal && e.date >= today)
    ?? races.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    ?? null;

  const phases = useMemo(() => {
    if (!goalRace) return [];
    // start del plan: 12 semanas antes por defecto si la fila del plan no está cargada aquí.
    const start = new Date(new Date(`${goalRace.date}T00:00:00`).getTime() - 15 * 7 * 86_400_000);
    return computePhases(start.toISOString().split('T')[0], goalRace.date);
  }, [goalRace]);

  const compliance = useMemo(() => {
    if (phases.length === 0) return 0;
    const start = phases[0].start;
    const plannedPerWeek = days.filter((d) => d.sessionType !== 'rest').length;
    const weeksElapsed = Math.max(0, Math.min(
      (Date.now() - new Date(`${start}T00:00:00`).getTime()) / (7 * 86_400_000),
      phases.length * 20,
    ));
    const completed = sessions.filter((s) => s.session_date >= start).length;
    return compliancePct(completed, Math.round(weeksElapsed * plannedPerWeek));
  }, [phases, sessions, days]);

  const upcoming = events.filter((e) => (e.end_date ?? e.date) >= today && e.id !== goalRace?.id);
  const pastRaces = races.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const pendingResults = pastRaces.filter((e) => !e.race?.result_time);
  const results = pastRaces.filter((e) => e.race?.result_time);

  const openNew = (date: string) => { setEditing(null); setModalDate(date); setModalOpen(true); };
  const openEdit = (ev: CalendarEvent) => { setEditing(ev); setModalDate(ev.date); setModalOpen(true); };

  const handleSave = async (draft: EventDraft, id?: string): Promise<string | null> => {
    let savedId = id ?? null;
    let err: string | null;
    if (id) {
      err = await updateEvent(id, draft);
    } else {
      const res = await addEvent(draft);
      err = res.error;
      savedId = res.id;
    }
    if (!err && savedId && draft.kind === 'race' && draft.race?.is_goal) {
      await setGoalRace(savedId);
    }
    return err;
  };

  const handleResultSave = async (id: string, race: RaceDetails) => updateEvent(id, { race });

  const handleDayPress = (iso: string, dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) { openNew(iso); return; }
    const ev = dayEvents[0];
    if (ev.kind === 'race' && ev.date < today && !ev.race?.result_time) setResultRace(ev);
    else openEdit(ev);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {goalRace ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <RaceHeroCard race={goalRace} phases={phases} compliance={compliance} />
          </Animated.View>
        ) : (
          <PressableScale
            style={[s.emptyHero, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
            onPress={() => openNew(today)}
          >
            <Text style={s.emptyIcon}>🏁</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Añade tu primera carrera</Text>
            <Text style={[s.emptyText, { color: colors.text3 }]}>Cuenta atrás, objetivo y fases del plan hacia la meta.</Text>
          </PressableScale>
        )}

        <EventsCalendar events={events} onDayPress={handleDayPress} />

        {pendingResults.map((e) => (
          <EventRow key={e.id} event={e} onPress={() => setResultRace(e)} />
        ))}

        {upcoming.length > 0 && <Text style={[s.label, { color: colors.text3 }]}>PRÓXIMOS EVENTOS</Text>}
        {upcoming.map((e, i) => (
          <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).duration(250)}>
            <EventRow event={e} onPress={() => openEdit(e)} />
          </Animated.View>
        ))}

        {results.length > 0 && <Text style={[s.label, { color: colors.text3 }]}>RESULTADOS</Text>}
        {results.map((e) => (
          <EventRow key={e.id} event={e} onPress={() => setResultRace(e)} />
        ))}

        {!loading && events.length === 0 && (
          <Text style={[s.emptyText, { color: colors.text3, textAlign: 'center' }]}>
            Toca un día del calendario o el botón + para crear tu primer evento.
          </Text>
        )}
      </ScrollView>

      <PressableScale style={[s.fab, { backgroundColor: colors.accent }]} onPress={() => openNew(today)}>
        <Ionicons name="add" size={26} color="#fff" />
      </PressableScale>

      <EventModal
        visible={modalOpen}
        initialDate={modalDate}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={removeEvent}
      />
      <ResultModal
        visible={resultRace !== null}
        race={resultRace}
        history={races}
        onClose={() => setResultRace(null)}
        onSave={handleResultSave}
        onPB={() => setCelebrate((c) => c + 1)}
      />
      <Confetti trigger={celebrate} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 96, gap: Spacing.base },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65, marginTop: Spacing.gapSm },
  emptyHero: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.gapXs },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  emptyText: { fontSize: FontSize.base, lineHeight: 18 },
  fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 8 },
});
```

Nota: la Task 19 (Confetti) crea `components/ui/Confetti.tsx`. Si ejecutas las tareas en orden y tsc falla aquí por ese import, haz la Task 19 antes de tipar esta pantalla, o crea primero el componente y vuelve.

- [ ] **Step 2: Registrar la tab** — en `app/(tabs)/_layout.tsx`, entre `semana` y `chat`:

```tsx
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          headerTitle: 'Agenda',
          tabBarIcon: ({ color }) => <TabIcon name="flag" color={color} />,
        }}
      />
```

- [ ] **Step 3: Typecheck, verificación y commit**

Run: `npx tsc --noEmit` (tras Task 19 si el import de Confetti falla) y `npm run web`:
- La tab Agenda aparece con icono de bandera.
- Sin carrera: estado vacío con CTA; el + abre el modal.
- Crear carrera con fecha futura → hero con cuenta atrás y fases.
- Crear evento «✈️ Viaje» → aparece en el calendario y en próximos; los entrenamientos NO aparecen.
- Carrera con fecha pasada → CTA de resultado; guardar resultado muestra ritmo y (si procede) PB.

```bash
git add app/\(tabs\)/agenda.tsx app/\(tabs\)/_layout.tsx
git commit -m "feat: pestaña Agenda con carreras, calendario de eventos y resultados"
```

---
### Task 19: Confetti + ProgressRing + anillo en «Hoy»

**Files:**
- Create: `hooks/useReduceMotion.ts`
- Create: `components/ui/Confetti.tsx`
- Create: `components/ui/ProgressRing.tsx`
- Modify: `app/(tabs)/hoy.tsx` (añadir anillo semanal junto a la tira de progreso existente)
- Modify: `app/log/[day].tsx` (confeti al guardar sesión con éxito)

- [ ] **Step 1: Hook de reduced motion**

```ts
// hooks/useReduceMotion.ts
import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (active) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduce;
}
```

- [ ] **Step 2: Confetti (partículas Reanimated, sin dependencias nuevas)**

Se dispara cada vez que `trigger` incrementa (0 = nunca). ~1,5 s, `pointerEvents="none"`.

```tsx
// components/ui/Confetti.tsx
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const COLORS = ['#30d158', '#0a84ff', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff'];
const COUNT = 36;

function Particle({ index }: { index: number }) {
  const { width, height } = Dimensions.get('window');
  const progress = useSharedValue(0);
  const startX = (index / COUNT) * width + (index % 3) * 8;
  const drift = ((index % 7) - 3) * 30;
  const size = 6 + (index % 3) * 3;

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1400 + (index % 5) * 120, easing: Easing.out(Easing.quad) });
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + drift * progress.value },
      { translateY: -20 + (height * 0.9) * progress.value },
      { rotate: `${progress.value * (180 + index * 20)}deg` },
    ],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View
      style={[s.particle, style, { width: size, height: size * 1.6, backgroundColor: COLORS[index % COLORS.length] }]}
    />
  );
}

export function Confetti({ trigger }: { trigger: number }) {
  const reduce = useReduceMotion();
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (trigger === 0 || reduce) return;
    setBurst(trigger);
    const t = setTimeout(() => setBurst(0), 2000);
    return () => clearTimeout(t);
  }, [trigger, reduce]);

  if (burst === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: COUNT }, (_, i) => <Particle key={`${burst}-${i}`} index={i} />)}
    </View>
  );
}

const s = StyleSheet.create({
  particle: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
});
```

- [ ] **Step 3: ProgressRing (svg + Reanimated)**

```tsx
// components/ui/ProgressRing.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, FontWeight } from '../../constants/typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  done: number;
  total: number;
  size?: number;
}

export function ProgressRing({ done, total, size = 64 }: ProgressRingProps) {
  const { colors } = useTheme();
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke={colors.accent} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={s.center}>
        <Text style={[s.value, { color: colors.text }]}>{done}/{total}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.black, fontVariant: ['tabular-nums'] },
});
```

- [ ] **Step 4: Integrar en «Hoy» y en el registro**

En `app/(tabs)/hoy.tsx` (lee el archivo primero; ya usa `useWeekSessions` o similar para la tira semanal de `65a573a`):

```tsx
import { ProgressRing } from '../../components/ui/ProgressRing';
import { usePlan } from '../../lib/PlanContext';
// dentro del componente:
const { days } = usePlan();
const plannedThisWeek = days.filter((d) => d.sessionType !== 'rest').length;
// junto a la cabecera / tira de progreso semanal existente:
<ProgressRing done={weekSessions.length} total={plannedThisWeek} />
```

`weekSessions` = las sesiones de la semana que ya usa la tira (hook `useWeekSessions()` de `hooks/useTraining.ts`; si la pantalla no lo importa aún, añádelo).

En `app/log/[day].tsx`: añade `const [celebrate, setCelebrate] = useState(0);`, renderiza `<Confetti trigger={celebrate} />` como último hijo del contenedor raíz, y en el handler de guardado con éxito (antes del `router.back()` o equivalente) llama `setCelebrate((c) => c + 1)` + `tapSuccess()`; retrasa el `router.back()` 800 ms (`setTimeout`) para que el confeti se vea.

- [ ] **Step 5: Typecheck, verificación y commit**

`npx tsc --noEmit` → sin errores. En web: completar una sesión lanza confeti; el anillo de Hoy se anima al abrir.

```bash
git add hooks/useReduceMotion.ts components/ui/Confetti.tsx components/ui/ProgressRing.tsx app/\(tabs\)/hoy.tsx app/log/\[day\].tsx
git commit -m "feat: anillo de progreso semanal y confeti de celebración"
```

---

### Task 20: Carreras en el contexto del coach

**Files:**
- Modify: `lib/coach/context.ts`
- Modify: callers de `buildChatSystemPrompt` / `buildCoachSystemPrompt` (localiza con `grep -rn "buildChatSystemPrompt\|buildCoachSystemPrompt" app/ lib/`)

- [ ] **Step 1: Bloque de carreras en ambos prompts**

En `lib/coach/context.ts`, añade el helper y el parámetro opcional (default `[]` para no romper firmas):

```ts
import { CalendarEvent } from '../../types';

function racesContext(events: CalendarEvent[]): string {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = events
    .filter((e) => e.kind === 'race' && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
    .map((e) => {
      const days = Math.ceil((new Date(`${e.date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
      const goal = e.race?.is_goal ? ' [OBJETIVO PRINCIPAL]' : '';
      const target = e.race?.target_time ? `, objetivo ${e.race.target_time}` : '';
      return `• ${e.title} (${e.race?.distance_km} km, ${e.date}, faltan ${days} días${target})${goal}`;
    });
  const lastResult = events
    .filter((e) => e.kind === 'race' && e.race?.result_time)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (upcoming.length === 0 && !lastResult) return '';
  return `\nCARRERAS DEL ATLETA:\n${upcoming.join('\n') || 'Sin carreras próximas.'}${
    lastResult ? `\nÚltimo resultado: ${lastResult.title} — ${lastResult.race?.result_time} (${lastResult.race?.distance_km} km).` : ''
  }\nTen en cuenta la cuenta atrás (taper, carga) al aconsejar.\n`;
}
```

Cambia las firmas a `buildChatSystemPrompt(days, recentSessions, events: CalendarEvent[] = [])` (ídem `buildCoachSystemPrompt`) e inserta `${racesContext(events)}` justo después del bloque `ÚLTIMAS SESIONES REGISTRADAS` en ambos templates.

- [ ] **Step 2: Pasar eventos desde las pantallas**

En cada caller encontrado por el grep (esperados: `app/(tabs)/chat.tsx` o `app/chat/[id].tsx`, y `app/(tabs)/hoy.tsx`): añade `const { events } = useEvents();` y pasa `events` como tercer argumento.

- [ ] **Step 3: Typecheck + tests y commit**

`npx tsc --noEmit && npm test` → verde (los tests de `tests/coach/` no tocan estas funciones con el 3er parámetro opcional; si alguno construye el prompt, sigue pasando por el default `[]`).

```bash
git add lib/coach/context.ts app/
git commit -m "feat: el coach conoce las carreras y su cuenta atrás"
```

---

### Task 21: Entradas escalonadas en listas

**Files:**
- Modify: `app/(tabs)/semana.tsx`
- Modify: `app/(tabs)/historial.tsx`

- [ ] **Step 1: Patrón**

En cada lista principal (tarjetas de día en Semana; tarjetas de sesión en Historial), envuelve el item `i` con:

```tsx
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';
// en el componente:
const reduceMotion = useReduceMotion();
// en el map:
<Animated.View key={item.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 40).duration(250)}>
  {/* tarjeta existente sin cambios */}
</Animated.View>
```

Si la tarjeta ya renderiza dentro de un `View` con key propio, sustituye ese `View` por `Animated.View` en lugar de anidar. La Agenda ya lo hace (Task 18).

- [ ] **Step 2: Gradiente por deporte en las tarjetas de Semana**

En la tarjeta de día de `semana.tsx`, sustituye el fondo plano por un tinte con gradiente del color del deporte (spec §5.3): envuelve el contenido de la tarjeta en

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { SessionColors } from '../../constants/colors';

<LinearGradient
  colors={[`${SessionColors[day.sessionType] ?? colors.accent}26`, 'transparent']}
  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
  style={/* mismo borderRadius/padding que la tarjeta actual */}
>
  {/* contenido existente */}
</LinearGradient>
```

(`26` = alpha hex ~15%; el gradiente va montado sobre el `backgroundColor` actual de la tarjeta, que se mantiene). En `hoy.tsx`, aplica el mismo tinte a la tarjeta hero de la sesión del día si tiene fondo plano.

- [ ] **Step 3: Typecheck, verificación visual y commit**

`npx tsc --noEmit`; en web, Semana e Historial entran en cascada suave (y sin animación con reduce motion activado).

```bash
git add app/\(tabs\)/semana.tsx app/\(tabs\)/historial.tsx
git commit -m "polish: entradas escalonadas en semana e historial"
```

---

### Task 22: Cierre — CLAUDE.md, suite completa y verificación

**Files:**
- Modify: `CLAUDE.md` (estructura de archivos y tabs)

- [ ] **Step 1: Actualizar CLAUDE.md**

En la sección «Estructura de archivos»: añade `agenda.tsx` bajo `(tabs)/`, `components/agenda/`, `lib/agenda/`, `lib/training/`, `hooks/useEvents.ts`, y en «Base de datos» cambia «5 tablas» por «6 tablas» añadiendo `events` a la lista.

- [ ] **Step 2: Suite completa**

Run: `npm test && npx tsc --noEmit`
Expected: todos los tests verdes (coach + training + agenda), tsc limpio.

- [ ] **Step 3: Verificación end-to-end (web)**

Flujo completo: editar el martes (sin «Carga», acordeón, chips) → guardar → crear carrera objetivo 2026-10-25 con objetivo 1:29:59 → hero con cuenta atrás y fase actual → crear evento ✈️ multi-día → visible en calendario → carrera pasada + resultado → PB con confeti y análisis del coach en la ficha → preguntar al coach «¿cuánto queda para mi carrera?» y ver que responde con la cuenta atrás.

- [ ] **Step 4: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: estructura actualizada (agenda, events, lib/agenda)"
```

---

## Notas para el ejecutor

- **Orden:** las Tasks 1-2 y 9-12 son lógica pura (TDD estricto). La 19 crea `Confetti` que importa la 18: si vas en orden y tsc falla en la 18, crea antes `components/ui/Confetti.tsx`, `components/ui/ProgressRing.tsx` y `hooks/useReduceMotion.ts` (Step 1-3 de la 19).
- **Migración Supabase (Task 8):** requiere ejecutar SQL en el dashboard; si no puedes, pide al usuario y sigue con las tareas puras (9-12) mientras tanto.
- **Temas:** hay 3 temas (light/dark/nude). Nada de colores hardcodeados fuera de `SessionColors`, el gradiente del hero y los acentos de carrera/evento (`#ff375f`/`#ff9f0a`, decisión de diseño).
- **Typography:** verifica los nombres reales de `FontSize`/`FontWeight` en `constants/typography.ts` al primer uso (el plan asume `sm/base/md/lg/xl/body` y `label/heavy/black`).
- **npm roto:** la caché global tiene EACCES (BACKLOG §10). Si `expo install` falla, usa `--cache /tmp/npm-cache-clean`. Nunca `sudo` sin el usuario.





# Rediseño de «Hoy» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la pestaña Hoy en un dashboard del día (hero card, tira semanal, tiles de countdown/racha/RPE) con splash «Go to the next level» al arrancar, chat del coach en modal y pantalla de sesión en vivo con cronómetro.

**Architecture:** Los cálculos (bloques de sesión, racha, countdown) van a módulos puros en `lib/` con tests vitest (node, sin react-native — ver `vitest.config.ts`). La UI son componentes nuevos en `components/training/` y `components/ui/`, verificados con `npx tsc --noEmit` + prueba manual en Expo. El hilo diario del coach se mueve tal cual de `hoy.tsx` a un modal `app/coach.tsx`.

**Tech Stack:** React Native + Expo SDK 56, TypeScript estricto, expo-router (Stack), Animated (RN core), expo-linear-gradient (ya instalado), Supabase, vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-hoy-redesign-design.md`

**Convenciones del repo:** textos UI en español, código en inglés; estilos con `StyleSheet.create()` al final del archivo; sin `any`; colores vía `useTheme()` + tokens de `constants/`. Verifica cada tarea con `npx tsc --noEmit` (la UI no tiene test runner).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/training/blocks.ts` | Crear | Derivar bloques (calentamiento/principal/enfriamiento) de un `DayPlan` |
| `lib/training/streak.ts` | Crear | Cálculo de racha de días cumplidos |
| `lib/agenda/countdown.ts` | Crear | Próxima carrera + días restantes |
| `lib/coach/dailyThread.ts` | Crear | Get-or-create de la conversación «Hoy · fecha» |
| `app/coach.tsx` | Crear | Modal con el hilo diario del coach (código movido de hoy.tsx) |
| `components/ui/NextLevelSplash.tsx` | Crear | Splash overlay V2 |
| `components/training/HeroCard.tsx` | Crear | Tarjeta hero del entrenamiento de hoy |
| `components/training/WeekStrip.tsx` | Crear | Tira L-D con puntos |
| `components/training/StatTiles.tsx` | Crear | Tiles countdown / racha / RPE |
| `components/training/CoachPill.tsx` | Crear | Píldora «Habla con tu coach…» |
| `app/session/live.tsx` | Crear | Sesión en vivo con cronómetro |
| `app/(tabs)/hoy.tsx` | Reescribir | Dashboard |
| `app/_layout.tsx` | Modificar | Registrar rutas `coach` (modal) y `session/live` |

---

### Task 1: Bloques de sesión (`lib/training/blocks.ts`)

**Files:**
- Create: `lib/training/blocks.ts`
- Test: `tests/training/blocks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/training/blocks.test.ts
import { describe, it, expect } from 'vitest';
import { deriveBlocks } from '../../lib/training/blocks';
import { DayPlan } from '../../types';

function day(partial: Partial<DayPlan>): DayPlan {
  return {
    day: 'thursday',
    dayName: 'Jueves',
    sessionType: 'running_intervals',
    title: 'Intervalos VO2max',
    duration: 55,
    description: '6x800m ritmo 5K, rec 2min',
    ...partial,
  };
}

describe('deriveBlocks', () => {
  it('devuelve warmup, principal y cooldown cuando existen', () => {
    const blocks = deriveBlocks(day({ warmup: '15 min suave', cooldown: '10 min trote' }));
    expect(blocks.map((b) => b.key)).toEqual(['warmup', 'main', 'cooldown']);
    expect(blocks[0]).toEqual({ key: 'warmup', label: 'Calentamiento', detail: '15 min suave' });
    expect(blocks[1].detail).toBe('6x800m ritmo 5K, rec 2min');
    expect(blocks[2].label).toBe('Enfriamiento');
  });

  it('omite bloques sin contenido', () => {
    const blocks = deriveBlocks(day({ warmup: '  ', cooldown: undefined }));
    expect(blocks.map((b) => b.key)).toEqual(['main']);
  });

  it('resume ejercicios en el bloque principal si existen', () => {
    const blocks = deriveBlocks(day({
      exercises: [
        { id: '1', name: 'Sentadilla' },
        { id: '2', name: 'Press banca' },
      ],
    }));
    expect(blocks.find((b) => b.key === 'main')?.detail).toBe('2 ejercicios');
  });

  it('singular para un ejercicio', () => {
    const blocks = deriveBlocks(day({ exercises: [{ id: '1', name: 'Sentadilla' }] }));
    expect(blocks.find((b) => b.key === 'main')?.detail).toBe('1 ejercicio');
  });

  it('día de descanso no tiene bloques', () => {
    expect(deriveBlocks(day({ sessionType: 'rest' }))).toEqual([]);
  });

  it('sin warmup, description ni exercises devuelve vacío', () => {
    expect(deriveBlocks(day({ description: '' }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/training/blocks.test.ts`
Expected: FAIL — `Cannot find module '../../lib/training/blocks'` (o similar).

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/training/blocks.ts
import { DayPlan } from '../../types';

export interface SessionBlock {
  key: 'warmup' | 'main' | 'cooldown';
  label: string;
  detail: string;
}

// Bloques para la hero card y la sesión en vivo. Solo se emiten los que
// tienen contenido; un día de descanso no tiene bloques.
export function deriveBlocks(plan: DayPlan): SessionBlock[] {
  if (plan.sessionType === 'rest') return [];
  const blocks: SessionBlock[] = [];

  const warmup = plan.warmup?.trim();
  if (warmup) blocks.push({ key: 'warmup', label: 'Calentamiento', detail: warmup });

  const main = plan.exercises?.length
    ? `${plan.exercises.length} ejercicio${plan.exercises.length === 1 ? '' : 's'}`
    : plan.description?.trim() ?? '';
  if (main) blocks.push({ key: 'main', label: 'Principal', detail: main });

  const cooldown = plan.cooldown?.trim();
  if (cooldown) blocks.push({ key: 'cooldown', label: 'Enfriamiento', detail: cooldown });

  return blocks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/training/blocks.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/training/blocks.ts tests/training/blocks.test.ts
git commit -m "feat: deriveBlocks — bloques de sesión desde DayPlan"
```

---

### Task 2: Racha (`lib/training/streak.ts`)

**Files:**
- Create: `lib/training/streak.ts`
- Test: `tests/training/streak.test.ts`

Reglas (del spec): se camina hacia atrás desde hoy. Día con sesión registrada → suma. Día de descanso en el plan sin sesión → no rompe ni suma. Día planificado sin sesión → rompe. Hoy sin registrar aún → se salta sin romper.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/training/streak.test.ts
import { describe, it, expect } from 'vitest';
import { computeStreak } from '../../lib/training/streak';

// Jueves 2026-07-09. Mediodía UTC para que toISOString no cambie de día.
const TODAY = new Date('2026-07-09T12:00:00Z');
const noRest = () => false;
// Domingo descansa (como el plan real: sunday = active_recovery no es rest,
// pero el test usa un plan sintético con domingo de descanso).
const sundayRest = (dayKey: string) => dayKey === 'sunday';

describe('computeStreak', () => {
  it('sin sesiones devuelve 0', () => {
    expect(computeStreak([], noRest, TODAY)).toBe(0);
  });

  it('hoy y ayer registrados → 2', () => {
    expect(computeStreak(['2026-07-09', '2026-07-08'], noRest, TODAY)).toBe(2);
  });

  it('hoy sin registrar no rompe: cuenta desde ayer', () => {
    expect(computeStreak(['2026-07-08', '2026-07-07'], noRest, TODAY)).toBe(2);
  });

  it('un hueco en día planificado rompe la racha', () => {
    // 2026-07-08 (miércoles) sin sesión y planificado → solo cuenta hoy
    expect(computeStreak(['2026-07-09', '2026-07-07'], noRest, TODAY)).toBe(1);
  });

  it('el descanso del plan no rompe la racha', () => {
    // Domingo 2026-07-05 descansa; sesiones L-M-X-J alrededor + sábado
    const dates = ['2026-07-09', '2026-07-08', '2026-07-07', '2026-07-06', '2026-07-04'];
    expect(computeStreak(dates, sundayRest, TODAY)).toBe(5);
  });

  it('el descanso no suma aunque haya continuidad', () => {
    // Solo hoy + descanso ayer (sintético): racha = 1, no 2
    const restYesterday = (dayKey: string) => dayKey === 'wednesday';
    expect(computeStreak(['2026-07-09'], restYesterday, TODAY)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/training/streak.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/training/streak.ts
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Racha de días cumpliendo el plan, caminando hacia atrás desde `today`.
// Los descansos del plan mantienen la racha sin sumar; hoy sin registrar se salta.
export function computeStreak(
  sessionDates: Iterable<string>,
  isRestDay: (dayKey: string) => boolean,
  today: Date = new Date(),
): number {
  const dates = new Set(sessionDates);
  const cursor = new Date(today);

  if (!dates.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let i = 0; i < 366; i++) {
    if (dates.has(iso(cursor))) streak++;
    else if (!isRestDay(DAY_KEYS[cursor.getDay()])) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/training/streak.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/training/streak.ts tests/training/streak.test.ts
git commit -m "feat: computeStreak — racha de días cumpliendo el plan"
```

---

### Task 3: Countdown a carrera (`lib/agenda/countdown.ts`)

**Files:**
- Create: `lib/agenda/countdown.ts`
- Test: `tests/agenda/countdown.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/agenda/countdown.test.ts
import { describe, it, expect } from 'vitest';
import { nextRace, daysUntil } from '../../lib/agenda/countdown';
import { CalendarEvent } from '../../types';

function ev(partial: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'x', user_id: 'u', title: 'Evento', date: '2026-10-11', kind: 'race', ...partial };
}

describe('nextRace', () => {
  it('devuelve la carrera futura más cercana, ignorando eventos no-carrera', () => {
    const events = [
      ev({ id: 'a', date: '2026-12-05' }),
      ev({ id: 'b', date: '2026-10-11' }),
      ev({ id: 'c', date: '2026-09-01', kind: 'event' }),
    ];
    expect(nextRace(events, '2026-07-09')?.id).toBe('b');
  });

  it('ignora carreras pasadas', () => {
    expect(nextRace([ev({ date: '2026-07-08' })], '2026-07-09')).toBeNull();
  });

  it('una carrera hoy cuenta como próxima', () => {
    expect(nextRace([ev({ date: '2026-07-09' })], '2026-07-09')?.date).toBe('2026-07-09');
  });

  it('sin eventos devuelve null', () => {
    expect(nextRace([], '2026-07-09')).toBeNull();
  });
});

describe('daysUntil', () => {
  it('cuenta días de calendario', () => {
    expect(daysUntil('2026-10-11', '2026-07-09')).toBe(94);
  });

  it('hoy es 0', () => {
    expect(daysUntil('2026-07-09', '2026-07-09')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agenda/countdown.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/agenda/countdown.ts
import { CalendarEvent } from '../../types';

export function nextRace(events: CalendarEvent[], todayIso: string): CalendarEvent | null {
  const upcoming = events
    .filter((e) => e.kind === 'race' && e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

export function daysUntil(dateIso: string, todayIso: string): number {
  const ms = Date.parse(`${dateIso}T00:00:00`) - Date.parse(`${todayIso}T00:00:00`);
  return Math.round(ms / 86_400_000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agenda/countdown.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/agenda/countdown.ts tests/agenda/countdown.test.ts
git commit -m "feat: nextRace y daysUntil para el countdown de Hoy"
```

---

### Task 4: Hilo diario + modal del coach (`app/coach.tsx`)

**Files:**
- Create: `lib/coach/dailyThread.ts`
- Create: `app/coach.tsx`
- Modify: `app/_layout.tsx` (registrar la ruta, tras la Screen de `ajustes`)

El modal es el hilo actual de `app/(tabs)/hoy.tsx` movido casi literal (saludo, chips, audio, propuestas). En este task **no se toca hoy.tsx**: ambas superficies conviven hasta el Task 9. No hay test unitario (todo depende de Supabase/RN); verificación con `tsc` y manual al final.

- [ ] **Step 1: Extraer get-or-create del hilo diario**

```typescript
// lib/coach/dailyThread.ts
import { supabase } from '../supabase';

// Una conversación por usuario y día, titulada «Hoy · yyyy-mm-dd».
export async function getOrCreateDailyThread(userId: string, todayIso: string): Promise<string | null> {
  const title = `Hoy · ${todayIso}`;
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select('id')
    .single();
  return (created?.id as string) ?? null;
}
```

- [ ] **Step 2: Crear el modal `app/coach.tsx`**

Código completo (es hoy.tsx actual sin header row/ProgressRing/useWeekSessions, usando el helper del paso 1):

```tsx
// app/coach.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import { FontSize } from '../constants/typography';
import { supabase } from '../lib/supabase';
import { usePlan } from '../lib/PlanContext';
import { useToday, getPhaseLabel } from '../hooks/useTraining';
import { useRecorder } from '../hooks/useRecorder';
import { useEvents } from '../hooks/useEvents';
import { buildGreeting } from '../lib/coach/greeting';
import { buildCoachSystemPrompt } from '../lib/coach/context';
import { getOrCreateDailyThread } from '../lib/coach/dailyThread';
import { askCoach, transcribeAudio } from '../lib/coach/api';
import { executeProposal } from '../lib/coach/actions';
import type { ActionProposal } from '../lib/coach/types';
import { ChatMessage, TrainingSession } from '../types';
import { MessageBubble } from '../components/coach/MessageBubble';
import { ProposalCard, ProposalStatus } from '../components/coach/ProposalCard';
import { ActionChips } from '../components/coach/ActionChips';
import { CoachInput } from '../components/coach/CoachInput';

interface ThreadItem {
  role: 'user' | 'assistant';
  content: string;
  proposal?: ActionProposal;
  proposalStatus?: ProposalStatus;
  proposalError?: string;
}

export default function CoachModal() {
  const { colors } = useTheme();
  const { weeks, currentWeekIndex, save, setWeekIndex } = usePlan();
  const days = weeks[currentWeekIndex]?.days ?? [];
  const { plan: todayPlan, weekNumber, dayKey } = useToday();
  const recorder = useRecorder();
  const { events } = useEvents();

  const [items, setItems] = useState<ThreadItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<TrainingSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [initializing, setInitializing] = useState(true);
  const listRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let active = true;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setInitializing(false); return; }
      userIdRef.current = user.id;

      const { data: sessions } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false })
        .limit(3);
      if (active) setRecentSessions((sessions ?? []) as TrainingSession[]);

      const convId = await getOrCreateDailyThread(user.id, todayIso);
      if (!convId) { setInitializing(false); return; }
      conversationIdRef.current = convId;

      const { data: history } = await supabase
        .from('ai_conversations')
        .select('role, content')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      if (active) {
        const rows = (history ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>;
        setItems(rows.map((m) => ({ role: m.role, content: m.content })));
        setInitializing(false);
      }
    }
    init();
    return () => { active = false; };
  }, [todayIso]);

  useEffect(() => {
    if (items.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [items]);

  const persist = useCallback(async (msg: ChatMessage) => {
    if (!userIdRef.current || !conversationIdRef.current) return;
    await supabase.from('ai_conversations').insert({
      user_id: userIdRef.current,
      conversation_id: conversationIdRef.current,
      role: msg.role,
      content: msg.content,
    });
  }, []);

  const sendToCoach = useCallback(async (text: string) => {
    const userMsg: ThreadItem = { role: 'user', content: text };
    setItems((prev) => [...prev, userMsg]);
    setBusy(true);
    setBusyLabel('Coach pensando…');
    await persist({ role: 'user', content: text });

    try {
      const historyMessages: ChatMessage[] = [...items, userMsg]
        .slice(-10)
        .map((i) => ({ role: i.role, content: i.content }));
      const systemPrompt = buildCoachSystemPrompt(days, recentSessions, events);
      const reply = await askCoach([
        { role: 'system', content: systemPrompt },
        ...historyMessages,
      ]);

      const assistantItem: ThreadItem = reply.kind === 'proposal'
        ? { role: 'assistant', content: reply.content, proposal: reply.proposal, proposalStatus: 'idle' }
        : { role: 'assistant', content: reply.content };
      setItems((prev) => [...prev, assistantItem]);
      if (assistantItem.content) await persist({ role: 'assistant', content: assistantItem.content });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Inténtalo de nuevo.';
      setItems((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }, [items, days, recentSessions, events, persist]);

  const handleAudio = useCallback(async (blob: Blob) => {
    setBusy(true);
    setBusyLabel('Transcribiendo…');
    try {
      const text = await transcribeAudio(blob);
      if (!text) {
        setItems((prev) => [...prev, { role: 'assistant', content: '⚠️ No he entendido el audio. ¿Lo repites?' }]);
        setBusy(false);
        return;
      }
      setBusy(false);
      await sendToCoach(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error transcribiendo.';
      setItems((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
      setBusy(false);
    }
  }, [sendToCoach]);

  const handleConfirm = useCallback(async (index: number) => {
    const item = items[index];
    if (!item?.proposal) return;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, proposalStatus: 'applying' } : it)));

    // Ancla el guardado a la semana actual: la selección de la pestaña Semana
    // no debe decidir sobre qué semana escribe el coach.
    const error = await executeProposal(item.proposal, {
      days,
      savePlan: (next) => save(next, currentWeekIndex),
    });

    if (error) {
      setItems((prev) => prev.map((it, i) =>
        i === index ? { ...it, proposalStatus: 'error', proposalError: error } : it,
      ));
      return;
    }
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, proposalStatus: 'done' } : it)));
    const confirmation: ChatMessage = { role: 'assistant', content: '✓ Hecho. Lo tienes en Historial.' };
    setItems((prev) => [...prev, { role: 'assistant', content: confirmation.content }]);
    await persist(confirmation);
  }, [items, days, save, currentWeekIndex, persist]);

  const handleEdit = useCallback((index: number) => {
    const p = items[index]?.proposal;
    if (!p || (p.action !== 'log_session' && p.action !== 'edit_session')) return;
    router.push({
      pathname: '/log/[day]',
      params: { day: dayKey, prefill: JSON.stringify(p.args), date: p.args.session_date },
    });
  }, [items, dayKey]);

  const planToday = days.find((d) => d.day === dayKey) ?? todayPlan;
  const greeting = buildGreeting(planToday ?? null, weekNumber, getPhaseLabel(weekNumber), recentSessions[0] ?? null);
  const showChips = !items.some((i) => i.role === 'user');

  if (initializing) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <MessageBubble role="assistant" content={greeting} />
              {showChips && (
                <ActionChips
                  micSupported={recorder.supported}
                  onRecord={() => { void recorder.start(); }}
                  onManualLog={() => router.push({ pathname: '/log/[day]', params: { day: dayKey } })}
                  onViewPlan={() => {
                    setWeekIndex(currentWeekIndex);
                    router.push({ pathname: '/plan/[day]', params: { day: dayKey } });
                  }}
                />
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <MessageBubble role={item.role} content={item.content}>
              {item.proposal && (
                <ProposalCard
                  proposal={item.proposal}
                  status={item.proposalStatus ?? 'idle'}
                  error={item.proposalError}
                  onConfirm={() => handleConfirm(index)}
                  onEdit={
                    item.proposal.action === 'log_session' || item.proposal.action === 'edit_session'
                      ? () => handleEdit(index)
                      : undefined
                  }
                />
              )}
            </MessageBubble>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {busy && (
          <View style={s.typing}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[s.typingText, { color: colors.text3 }]}>{busyLabel}</Text>
          </View>
        )}

        <CoachInput onSendText={sendToCoach} onSendAudio={handleAudio} busy={busy} recorder={recorder} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.lg, paddingBottom: Spacing.gapSm },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.gapSm,
    gap: Spacing.gapSm,
  },
  typingText: { fontSize: FontSize.md },
});
```

- [ ] **Step 3: Registrar la ruta modal en `app/_layout.tsx`**

Añadir dentro del `<Stack>`, después de la Screen de `ajustes`:

```tsx
              <Stack.Screen
                name="coach"
                options={{
                  headerShown: true,
                  headerTitle: 'Coach',
                  presentation: 'modal',
                }}
              />
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/coach/dailyThread.ts app/coach.tsx app/_layout.tsx
git commit -m "feat: modal del coach con el hilo diario (audio + propuestas)"
```

---

### Task 5: Splash `NextLevelSplash`

**Files:**
- Create: `components/ui/NextLevelSplash.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/ui/NextLevelSplash.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { FontWeight } from '../../constants/typography';

let shownThisLaunch = false;

// true solo la primera vez por arranque (el flag vive en memoria: cada cold
// start vuelve a mostrar el splash; cambiar de pestaña no).
export function consumeSplashSlot(): boolean {
  if (shownThisLaunch) return false;
  shownThisLaunch = true;
  return true;
}

interface Props {
  onDone: () => void;
}

export function NextLevelSplash({ onDone }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const line = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  const finish = useCallback((fast: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: fast ? 200 : 600,
      useNativeDriver: true,
    }).start(() => onDone());
  }, [opacity, onDone]);

  useEffect(() => {
    const fadeIn = reduceMotion ? 200 : 400;
    const hold = reduceMotion ? 1100 : 2500;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: fadeIn, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: reduceMotion ? 0 : 500, useNativeDriver: true }),
      Animated.timing(line, { toValue: 1, duration: reduceMotion ? 0 : 900, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => finish(false), fadeIn + hold);
    return () => clearTimeout(t);
  }, [reduceMotion, opacity, scale, line, finish]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.overlay, { opacity }]}>
      <Pressable style={s.press} onPress={() => finish(true)} accessibilityLabel="Saltar introducción">
        <Animated.View style={[s.inner, { transform: [{ scale }] }]}>
          <Text style={[s.phrase, { textShadowColor: colors.accent }]}>
            GO TO THE{'\n'}NEXT LEVEL
          </Text>
          <Animated.View style={[s.lineWrap, { transform: [{ scaleX: line }] }]}>
            <LinearGradient
              colors={['transparent', colors.accent, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.line}
            />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(8,9,11,0.78)', zIndex: 100 },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner: { alignItems: 'center' },
  phrase: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: FontWeight.heavy,
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 42,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  lineWrap: { width: 160, height: 3, marginTop: 18 },
  line: { flex: 1, borderRadius: 2 },
});
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/ui/NextLevelSplash.tsx
git commit -m "feat: splash Go to the next level (overlay con glow, saltable)"
```

---

### Task 6: `HeroCard`

**Files:**
- Create: `components/training/HeroCard.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/training/HeroCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { SessionColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { deriveBlocks } from '../../lib/training/blocks';
import { DayPlan, SessionType } from '../../types';

const SPORT_LABEL: Record<SessionType, string> = {
  running_easy: 'Running',
  running_threshold: 'Running',
  running_long: 'Running',
  running_intervals: 'Running',
  swimming: 'Natación',
  gym_strength: 'Gimnasio',
  gym_hyrox: 'Hyrox',
  hyrox_simulation: 'Hyrox',
  rest: 'Descanso',
  active_recovery: 'Recuperación',
};

interface Props {
  plan: DayPlan | null;
  onStart: () => void;
  onLog: () => void;
  onEditPlan: () => void;
}

export function HeroCard({ plan, onStart, onLog, onEditPlan }: Props) {
  const { colors } = useTheme();

  if (!plan) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.title, { color: colors.text }]}>Sin sesión planificada</Text>
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: colors.accent }]}
            onPress={onEditPlan}
            activeOpacity={0.8}
          >
            <Text style={s.btnPrimaryText}>Ver plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tint = SessionColors[plan.sessionType] ?? colors.accent;
  const isRest = plan.sessionType === 'rest';
  const blocks = deriveBlocks(plan);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: isRest ? colors.border : `${tint}59` }]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: isRest ? 0.04 : 0.1, borderRadius: Radius.card }]}
      />
      <Text style={[s.kicker, { color: isRest ? colors.text3 : tint }]}>
        {plan.dayName.toUpperCase()} · HOY
      </Text>
      <Text style={[s.title, { color: colors.text }]}>{plan.title}</Text>
      <Text style={[s.meta, { color: colors.text2 }]}>
        {plan.duration} min · {SPORT_LABEL[plan.sessionType]}
      </Text>

      {blocks.length > 0 && (
        <View style={s.blocks}>
          {blocks.map((b) => (
            <View key={b.key} style={[s.block, { borderColor: colors.border, backgroundColor: colors.glassBg }]}>
              <Text style={[s.blockLabel, { color: colors.text }]} numberOfLines={1}>{b.label}</Text>
              <Text style={[s.blockDetail, { color: colors.text3 }]} numberOfLines={2}>{b.detail}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.actions}>
        {!isRest && (
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: tint }]}
            onPress={onStart}
            activeOpacity={0.8}
          >
            <Text style={s.btnPrimaryText}>▶ Empezar sesión</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnGhost, { borderColor: colors.border, backgroundColor: colors.glassBg }]}
          onPress={onLog}
          activeOpacity={0.8}
        >
          <Text style={[s.btnGhostText, { color: colors.text }]}>Registrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.cardPadding,
    overflow: 'hidden',
  },
  kicker: {
    fontSize: FontSize.s,
    fontWeight: FontWeight.heavy,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.4,
    marginTop: Spacing.xxs,
  },
  meta: { fontSize: FontSize.base, marginTop: 2 },
  blocks: { flexDirection: 'row', gap: Spacing.gapXs, marginTop: Spacing.base },
  block: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.s,
  },
  blockLabel: { fontSize: FontSize.s, fontWeight: FontWeight.heavy },
  blockDetail: { fontSize: FontSize.xs, marginTop: 1 },
  actions: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.lg },
  btnPrimary: {
    flex: 1.4,
    borderRadius: Radius.md,
    paddingVertical: Spacing.inputPaddingV,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#ffffff', fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.inputPaddingV,
    alignItems: 'center',
  },
  btnGhostText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/training/HeroCard.tsx
git commit -m "feat: HeroCard del entrenamiento de hoy con bloques y acciones"
```

---

### Task 7: `WeekStrip`

**Files:**
- Create: `components/training/WeekStrip.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/training/WeekStrip.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { DayPlan } from '../../types';

const WEEK_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LETTER: Record<string, string> = {
  monday: 'L', tuesday: 'M', wednesday: 'X', thursday: 'J',
  friday: 'V', saturday: 'S', sunday: 'D',
};

interface Props {
  days: DayPlan[];
  doneDayKeys: Set<string>;
  todayKey: string;
  todayColor: string;
  onPressDay: () => void;
}

export function WeekStrip({ days, doneDayKeys, todayKey, todayColor, onPressDay }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[s.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {WEEK_ORDER.map((key) => {
        const done = doneDayKeys.has(key);
        const isToday = key === todayKey;
        const isRest = days.find((d) => d.day === key)?.sessionType === 'rest';
        return (
          <Pressable key={key} style={s.day} onPress={onPressDay}>
            <Text style={[s.letter, { color: isToday ? colors.text : colors.text3 }]}>
              {DAY_LETTER[key]}
            </Text>
            {done ? (
              <View style={[s.dot, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                <Text style={[s.dotText, { color: colors.accent }]}>✓</Text>
              </View>
            ) : isToday ? (
              <View style={[s.dot, { backgroundColor: todayColor, borderColor: todayColor }]}>
                <Text style={[s.dotText, { color: '#ffffff' }]}>{DAY_LETTER[key]}</Text>
              </View>
            ) : (
              <View
                style={[
                  s.dot,
                  s.pending,
                  { borderColor: colors.border, opacity: isRest ? 0.5 : 1 },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginTop: Spacing.gapLg,
  },
  day: { alignItems: 'center', gap: Spacing.gapXxs },
  letter: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy },
  dot: {
    width: 26,
    height: 26,
    borderRadius: Radius.circle,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: { borderStyle: 'dashed' },
  dotText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy },
});
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/training/WeekStrip.tsx
git commit -m "feat: WeekStrip — semana de un vistazo en Hoy"
```

---

### Task 8: `StatTiles` y `CoachPill`

**Files:**
- Create: `components/training/StatTiles.tsx`
- Create: `components/training/CoachPill.tsx`

- [ ] **Step 1: Crear `StatTiles`**

```tsx
// components/training/StatTiles.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface Props {
  raceDays: number | null;
  raceTitle: string | null;
  streak: number;
  avgRpe: number | null;
}

export function StatTiles({ raceDays, raceTitle, streak, avgRpe }: Props) {
  const { colors } = useTheme();
  const tile = [s.tile, { backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <View style={s.row}>
      <View style={tile}>
        <Text style={[s.value, { color: colors.teal }]}>
          {raceDays == null ? '—' : `${raceDays} d`}
        </Text>
        <Text style={[s.label, { color: colors.text3 }]} numberOfLines={1}>
          {raceTitle ?? 'Sin carrera'}
        </Text>
      </View>
      <View style={tile}>
        <Text style={[s.value, { color: colors.orange }]}>🔥 {streak}</Text>
        <Text style={[s.label, { color: colors.text3 }]} numberOfLines={1}>Racha de días</Text>
      </View>
      <View style={tile}>
        <Text style={[s.value, { color: colors.text }]}>
          {avgRpe == null ? '—' : avgRpe.toFixed(1)}
        </Text>
        <Text style={[s.label, { color: colors.text3 }]} numberOfLines={1}>RPE medio sem.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.gapMd },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, letterSpacing: -0.3 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 2 },
});
```

- [ ] **Step 2: Crear `CoachPill`**

```tsx
// components/training/CoachPill.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { PressableScale } from '../ui/PressableScale';

interface Props {
  onPress: () => void;
}

export function CoachPill({ onPress }: Props) {
  const { colors } = useTheme();

  return (
    <PressableScale onPress={onPress} style={s.wrap} accessibilityLabel="Habla con tu coach">
      <LinearGradient
        colors={['rgba(48,209,88,0.14)', 'rgba(10,132,255,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.pill, { backgroundColor: colors.card, borderColor: `${colors.accent}59` }]}
      >
        <Text style={[s.text, { color: colors.text2 }]}>Habla con tu coach…</Text>
        <View style={[s.mic, { backgroundColor: colors.accent }]}>
          <Ionicons name="mic" size={15} color="#ffffff" />
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.gapSm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
    overflow: 'hidden',
  },
  text: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  mic: {
    width: 28,
    height: 28,
    borderRadius: Radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

Nota: la píldora lleva **solo** el icono de micro (decisión del usuario: sin avatar ni icono de mensaje).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/training/StatTiles.tsx components/training/CoachPill.tsx
git commit -m "feat: StatTiles (countdown/racha/RPE) y CoachPill"
```

---

### Task 9: Reescribir `app/(tabs)/hoy.tsx` como dashboard

**Files:**
- Modify: `app/(tabs)/hoy.tsx` (reemplazo completo del archivo)

El chat inline desaparece de Hoy (ya vive en `app/coach.tsx` desde el Task 4).

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
// app/(tabs)/hoy.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SessionColors } from '../../constants/colors';
import { usePlan } from '../../lib/PlanContext';
import { useSessions, useWeekSessions } from '../../hooks/useTraining';
import { useEvents } from '../../hooks/useEvents';
import { DAY_MAP } from '../../lib/coach/context';
import { computeStreak } from '../../lib/training/streak';
import { nextRace, daysUntil } from '../../lib/agenda/countdown';
import { WEEKLY_STRUCTURE } from '../../constants/trainingPlan';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { NextLevelSplash, consumeSplashSlot } from '../../components/ui/NextLevelSplash';
import { HeroCard } from '../../components/training/HeroCard';
import { WeekStrip } from '../../components/training/WeekStrip';
import { StatTiles } from '../../components/training/StatTiles';
import { CoachPill } from '../../components/training/CoachPill';

export default function HoyScreen() {
  const { colors } = useTheme();
  const { weeks, currentWeekIndex, setWeekIndex } = usePlan();
  const days = weeks[currentWeekIndex]?.days ?? [];
  const { sessions: weekSessions, refetch: refetchWeek } = useWeekSessions();
  const { sessions: recentSessions, refetch: refetchRecent } = useSessions(60);
  const { events } = useEvents();
  const [showSplash, setShowSplash] = useState(consumeSplashSlot);

  const todayKey = DAY_MAP[new Date().getDay()];
  const todayIso = new Date().toISOString().split('T')[0];
  const planToday =
    days.find((d) => d.day === todayKey) ??
    WEEKLY_STRUCTURE.find((d) => d.day === todayKey) ??
    null;
  const plannedThisWeek = days.filter((d) => d.sessionType !== 'rest').length;

  // Al volver del modal del coach, de registrar o de la sesión en vivo,
  // las tarjetas deben reflejar la sesión recién guardada.
  useFocusEffect(
    useCallback(() => {
      refetchWeek();
      refetchRecent();
    }, [refetchWeek, refetchRecent]),
  );

  const doneDayKeys = new Set(
    weekSessions.map((s) => DAY_MAP[new Date(`${s.session_date}T00:00:00`).getDay()]),
  );
  const race = nextRace(events, todayIso);
  const streak = computeStreak(
    recentSessions.map((s) => s.session_date),
    (dayKey) => days.find((d) => d.day === dayKey)?.sessionType === 'rest',
  );
  const rpes = weekSessions
    .map((s) => s.rpe_perceived)
    .filter((n): n is number => typeof n === 'number');
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <View style={[s.weekChip, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <Text style={[s.weekChipText, { color: colors.text3 }]}>
              Semana {currentWeekIndex + 1} · {weeks[currentWeekIndex]?.focus ?? 'Base'}
            </Text>
          </View>
          <ProgressRing done={weekSessions.length} total={plannedThisWeek} size={48} />
        </View>

        <HeroCard
          plan={planToday}
          onStart={() => router.push({ pathname: '/session/live', params: { day: todayKey } })}
          onLog={() => router.push({ pathname: '/log/[day]', params: { day: todayKey } })}
          onEditPlan={() => {
            setWeekIndex(currentWeekIndex);
            router.push('/plan');
          }}
        />

        <WeekStrip
          days={days}
          doneDayKeys={doneDayKeys}
          todayKey={todayKey}
          todayColor={SessionColors[planToday?.sessionType ?? 'rest']}
          onPressDay={() => {
            setWeekIndex(currentWeekIndex);
            router.push('/(tabs)/semana');
          }}
        />

        <StatTiles
          raceDays={race ? daysUntil(race.date, todayIso) : null}
          raceTitle={race?.title ?? null}
          streak={streak}
          avgRpe={avgRpe}
        />
      </ScrollView>

      <CoachPill onPress={() => router.push('/coach')} />

      {showSplash && <NextLevelSplash onDone={() => setShowSplash(false)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.gapSm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  weekChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs,
  },
  weekChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
});
```

Notas:
- `useState(consumeSplashSlot)` pasa la función como inicializador lazy: consume el slot una sola vez aunque el componente re-monte dentro del mismo arranque solo si el flag lo permite.
- `/session/live` no existe todavía (Task 10); el typecheck de expo-router con rutas tipadas no está activo en este repo (rutas como strings), así que compila. Si `npx tsc --noEmit` se quejara de la ruta, hacer el Task 10 antes de este paso.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/hoy.tsx
git commit -m "feat: Hoy como dashboard — hero, semana, tiles y píldora del coach"
```

---

### Task 10: Sesión en vivo (`app/session/live.tsx`)

**Files:**
- Create: `app/session/live.tsx`
- Modify: `app/_layout.tsx` (registrar la ruta, tras la Screen de `coach`)

- [ ] **Step 1: Crear la pantalla**

```tsx
// app/session/live.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, TextStyles } from '../../constants/typography';
import { SessionColors } from '../../constants/colors';
import { usePlan } from '../../lib/PlanContext';
import { deriveBlocks } from '../../lib/training/blocks';

export default function LiveSessionScreen() {
  const { colors } = useTheme();
  const { day } = useLocalSearchParams<{ day: string }>();
  const { weeks, currentWeekIndex } = usePlan();
  const plan = (weeks[currentWeekIndex]?.days ?? []).find((d) => d.day === day) ?? null;
  const blocks = plan ? deriveBlocks(plan) : [];
  const tint = plan ? SessionColors[plan.sessionType] ?? colors.accent : colors.accent;

  // El cronómetro se deriva de timestamps: sobrevive a background/foreground
  // sin timers nativos (el intervalo solo refresca la vista).
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [blockIndex, setBlockIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const isLastBlock = blocks.length === 0 || blockIndex >= blocks.length - 1;

  const finish = () => {
    const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    router.replace({
      pathname: '/log/[day]',
      params: { day: day ?? '', prefill: JSON.stringify({ duration_min: durationMin }) },
    });
  };

  if (!plan) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={s.center}>
          <Text style={[s.emptyText, { color: colors.text3 }]}>No hay sesión planificada para hoy.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.text }]}>{plan.title}</Text>
        <Text style={[s.timer, { color: tint }]}>{mm}:{ss}</Text>

        <View style={s.blockList}>
          {blocks.map((b, i) => {
            const isDone = i < blockIndex;
            const isCurrent = i === blockIndex;
            return (
              <View
                key={b.key}
                style={[
                  s.blockRow,
                  { backgroundColor: colors.card, borderColor: isCurrent ? tint : colors.border },
                ]}
              >
                <Ionicons
                  name={isDone ? 'checkmark-circle' : isCurrent ? 'play-circle' : 'ellipse-outline'}
                  size={22}
                  color={isDone ? colors.accent : isCurrent ? tint : colors.text3}
                />
                <View style={s.blockTextWrap}>
                  <Text
                    style={[
                      s.blockLabel,
                      { color: isDone ? colors.text3 : colors.text },
                      isDone && s.strike,
                    ]}
                  >
                    {b.label}
                  </Text>
                  <Text style={[s.blockDetail, { color: colors.text3 }]} numberOfLines={2}>
                    {b.detail}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        {!isLastBlock && (
          <TouchableOpacity
            style={[s.btnGhost, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setBlockIndex((i) => i + 1)}
            activeOpacity={0.8}
          >
            <Text style={[s.btnGhostText, { color: colors.text }]}>Siguiente bloque</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: tint }]}
          onPress={finish}
          activeOpacity={0.8}
        >
          <Text style={s.btnPrimaryText}>Terminar y registrar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FontSize.md },
  scroll: { padding: Spacing.lg },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  timer: {
    ...TextStyles.timer,
    textAlign: 'center',
    marginVertical: Spacing.xxl,
    fontVariant: ['tabular-nums'],
  },
  blockList: { gap: Spacing.gapSm },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.gapMd,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
  },
  blockTextWrap: { flex: 1 },
  blockLabel: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  blockDetail: { fontSize: FontSize.base, marginTop: 1 },
  strike: { textDecorationLine: 'line-through' },
  footer: {
    flexDirection: 'row',
    gap: Spacing.gapSm,
    padding: Spacing.lg,
    paddingTop: Spacing.gapSm,
  },
  btnPrimary: {
    flex: 1.4,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#ffffff', fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  btnGhostText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
```

- [ ] **Step 2: Registrar la ruta en `app/_layout.tsx`**

Añadir dentro del `<Stack>`, después de la Screen de `coach` (Task 4):

```tsx
              <Stack.Screen
                name="session/live"
                options={{
                  headerShown: true,
                  headerTitle: 'Sesión en vivo',
                  headerBackTitle: 'Atrás',
                }}
              />
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/session/live.tsx app/_layout.tsx
git commit -m "feat: sesión en vivo con cronómetro y bloques"
```

---

### Task 11: Verificación final

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa + tipos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: todos los tests PASS (los 15 archivos previos + blocks + streak + countdown), tsc sin errores.

- [ ] **Step 2: Verificación manual en Expo**

Run: `npx expo start` y en el dispositivo/simulador comprobar:

1. **Splash**: al abrir la app aparece «GO TO THE NEXT LEVEL» sobre Hoy atenuado, se desvanece solo en ~3,5 s revelando el dashboard; un toque lo salta; al cambiar de pestaña y volver a Hoy **no** reaparece.
2. **Dashboard**: hero con el color del tipo de sesión de hoy, bloques visibles, chip de semana y anillo como antes.
3. **Empezar sesión**: cronómetro avanza; «Siguiente bloque» marca bloques; «Terminar y registrar» abre Registrar con la duración prellenada; guardar y volver a Hoy → el día sale con ✓ en la tira y el anillo suma.
4. **Píldora**: abre el modal del coach; enviar texto y audio funciona; una propuesta del coach se puede confirmar y al cerrar el modal Hoy refleja el cambio (useFocusEffect).
5. **Tiles**: countdown coincide con la próxima carrera de Agenda; racha coherente con Historial; RPE medio coincide con las sesiones de la semana.
6. **Día de descanso** (cambiar fecha del dispositivo o mirar un domingo): hero suave sin «Empezar sesión».
7. **Temas**: revisar dashboard en dark, light y nude.

- [ ] **Step 3: Commit final (si hubo ajustes) y cierre**

```bash
git status
```

Si la verificación manual obligó a retocar algo, commitear esos ajustes con mensaje `fix: ...`. Después, usar la skill superpowers:finishing-a-development-branch para decidir merge/PR.

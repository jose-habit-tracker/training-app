import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { askGroq } from '../../lib/groq';
import { supabase } from '../../lib/supabase';
import { ChatMessage, TrainingSession, DayPlan, ExerciseTemplate, SessionType } from '../../types';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { getCurrentWeek } from '../../hooks/useTraining';
import { usePlan } from '../../lib/PlanContext';

const GREETING: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy tu coach de IA. He cargado tu historial de entrenamiento reciente. ¿En qué puedo ayudarte?',
};

function confirmApply(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert('Aplicar cambios', message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Aplicar', onPress: () => resolve(true) },
    ]);
  });
}

const DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

// ─── Build system prompt with recent session context ──────────────────────────
function buildSystemPrompt(days: DayPlan[], recentSessions: TrainingSession[]): string {
  const weekNumber = getCurrentWeek();

  const now = new Date();
  const todayPlan = days.find((d) => d.day === DAY_MAP[now.getDay()]);
  const todayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todaySession = todayPlan
    ? `${todayPlan.title} (${SESSION_LABELS[todayPlan.sessionType] ?? todayPlan.sessionType}, ${todayPlan.duration} min)`
    : 'sin sesión definida';

  const sessionSummary = recentSessions.length > 0
    ? recentSessions.map((s) => {
        const parts = [
          `• ${s.day_name} (${s.session_date}): ${SESSION_LABELS[s.session_type] ?? s.session_type}`,
          s.rpe_perceived != null ? `RPE ${s.rpe_perceived}/10` : null,
          s.fatigue != null ? `Fatiga ${s.fatigue}/10` : null,
          s.notes ? `"${s.notes}"` : null,
        ].filter(Boolean);
        return parts.join(' — ');
      }).join('\n')
    : 'Sin sesiones recientes registradas.';

  const planJson = JSON.stringify(
    days.map((d) => ({
      day: d.day,
      dayName: d.dayName,
      sessionType: d.sessionType,
      title: d.title,
      duration: d.duration,
      description: d.description,
      warmup: d.warmup,
      cooldown: d.cooldown,
      notes: d.notes,
      exercises: (d.exercises ?? []).map(({ id, ...ex }) => ex),
    })),
  );
  const sessionTypes = Object.keys(SESSION_LABELS).join(', ');

  return `Eres el coach personal de un atleta de 23 años que se prepara para una media maratón y Hyrox posteriormente.
El atleta entrena 7 días a la semana: running, natación y gimnasio (énfasis Hyrox).
Estás en la semana ${weekNumber} del ciclo de entrenamiento.

HOY ES: ${todayStr}. La sesión programada para hoy es: ${todaySession}.
No deduzcas el día por tu cuenta; usa siempre esta fecha como "hoy".

ÚLTIMAS SESIONES REGISTRADAS:
${sessionSummary}

PLAN COMPLETO ACTUAL DEL ATLETA (JSON, fuente de verdad — incluye ejercicios, calentamiento, enfriamiento y notas de cada día):
${planJson}

CAPACIDAD DE EDICIÓN DEL PLAN:
- Tienes el plan completo arriba. Cuando el atleta te pregunte por una sesión, usa todos sus detalles (ejercicios, series, cargas, notas).
- Si el atleta te pide MODIFICAR el plan (cambiar ejercicios, tipo, duración, etc.), explica brevemente el cambio y AÑADE AL FINAL un bloque con el/los días modificados COMPLETOS, exactamente así:
\`\`\`plan
[{"day":"tuesday","dayName":"Martes","sessionType":"running_easy","title":"Carrera Suave","duration":40,"description":"...","warmup":"...","cooldown":"...","notes":"...","exercises":[{"name":"Rodaje suave","duration":"30 min","notes":"z2"}]}]
\`\`\`
- Incluye SOLO los días que cambian, con todos sus campos. El campo "day" debe ser uno de: monday, tuesday, wednesday, thursday, friday, saturday, sunday.
- "sessionType" debe ser uno de: ${sessionTypes}.
- NO incluyas el bloque \`\`\`plan si no te piden cambios.

INSTRUCCIONES:
- Responde siempre en español, de forma concisa y práctica.
- Basa tus respuestas en el contexto de sesiones recientes cuando sea relevante.
- Cuando hagas ajustes al plan, explica brevemente el razonamiento fisiológico.
- Tono motivador pero realista. Máximo 180 palabras por respuesta salvo que te pidan más detalle.`;
}

// ─── Plan-update parsing / applying ─────────────────────────────────────────────
const SESSION_TYPE_KEYS = Object.keys(SESSION_LABELS);

// Extrae el bloque ```plan ...``` de la respuesta del coach, si lo hay
function extractPlanUpdate(text: string): { clean: string; proposed: DayPlan[] | null } {
  const m = text.match(/```(?:plan|json)\s*([\s\S]*?)```/i);
  if (!m) return { clean: text, proposed: null };
  const clean = text.replace(m[0], '').trim();
  try {
    const parsed = JSON.parse(m[1].trim());
    const arr = (Array.isArray(parsed) ? parsed : [parsed]) as DayPlan[];
    if (!arr.length) return { clean: text, proposed: null };
    return { clean: clean || 'He preparado cambios en tu plan.', proposed: arr };
  } catch {
    return { clean: text, proposed: null };
  }
}

// ─── Saneado de la salida del LLM ───────────────────────────────────────────────
// El bloque ```plan lo escribe la IA; nunca confiamos en su forma. Cada campo se
// fuerza a su tipo esperado y lo que no encaje se descarta, para que una respuesta
// malformada no corrompa el plan ni rompa la UI.
function optStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
function optNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function sanitizeExercise(ex: unknown, id: string): ExerciseTemplate | null {
  if (!ex || typeof ex !== 'object') return null;
  const e = ex as Record<string, unknown>;
  const name = typeof e.name === 'string' ? e.name.trim() : '';
  if (!name) return null; // sin nombre no es un ejercicio válido
  return {
    id,
    name,
    sets: optNum(e.sets),
    reps: optStr(e.reps),
    load: optStr(e.load),
    distance: optStr(e.distance),
    duration: optStr(e.duration),
    rest: optStr(e.rest),
    notes: optStr(e.notes),
  };
}

// Fusiona los días propuestos sobre el plan actual, validando cada campo.
function applyProposed(current: DayPlan[], proposed: DayPlan[]): DayPlan[] {
  return current.map((d) => {
    const raw = proposed.find(
      (x) => x && typeof x === 'object' && (x as { day?: unknown }).day === d.day,
    ) as Record<string, unknown> | undefined;
    if (!raw) return d;

    const sessionType: SessionType = SESSION_TYPE_KEYS.includes(raw.sessionType as string)
      ? (raw.sessionType as SessionType)
      : d.sessionType;

    const exercises = Array.isArray(raw.exercises)
      ? raw.exercises
          .map((ex, i) => sanitizeExercise(ex, `${d.day}-${Date.now()}-${i}`))
          .filter((ex): ex is ExerciseTemplate => ex !== null)
      : d.exercises;

    const durNum = Number(raw.duration);

    return {
      day: d.day,
      dayName: d.dayName,
      sessionType,
      title: str(raw.title, d.title),
      duration: Number.isFinite(durNum) && durNum > 0 ? durNum : d.duration,
      description: str(raw.description, d.description),
      exercises,
      warmup: optStr(raw.warmup) ?? d.warmup,
      cooldown: optStr(raw.cooldown) ?? d.cooldown,
      notes: optStr(raw.notes) ?? d.notes,
    };
  });
}

// ─── Conversation screen ──────────────────────────────────────────────────────
export default function ConversationScreen() {
  const { colors } = useTheme();
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { days, save } = usePlan();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [recentSessions, setRecentSessions] = useState<TrainingSession[]>([]);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(days, recentSessions),
    [days, recentSessions],
  );

  useEffect(() => {
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
      setRecentSessions((sessions ?? []) as TrainingSession[]);

      const { data: history } = await supabase
        .from('ai_conversations')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      const historyMessages = (history ?? []) as ChatMessage[];
      setMessages(historyMessages.length === 0 ? [GREETING] : historyMessages);
      setInitializing(false);
    }
    init();
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const persistMessage = useCallback(async (msg: ChatMessage) => {
    if (!userIdRef.current) return;
    await supabase.from('ai_conversations').insert({
      user_id: userIdRef.current,
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
    });
  }, [conversationId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Primer mensaje del usuario → titula la conversación con un resumen
    const isFirstUserMsg = !messages.some((m) => m.role === 'user');

    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    await persistMessage(userMsg);
    await supabase
      .from('conversations')
      .update({
        updated_at: new Date().toISOString(),
        ...(isFirstUserMsg ? { title: text.slice(0, 48) } : {}),
      })
      .eq('id', conversationId);

    try {
      const contextWindow = next.slice(-10);
      const reply = await askGroq(contextWindow, systemPrompt);
      const assistantMsg: ChatMessage = { role: 'assistant', content: reply };
      setMessages([...next, assistantMsg]);
      await persistMessage(assistantMsg);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `Error al contactar con el coach: ${err instanceof Error ? err.message : 'Inténtalo de nuevo.'}`,
      };
      setMessages([...next, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, systemPrompt, persistMessage, conversationId]);

  const handleApply = useCallback(async (index: number, proposed: DayPlan[]) => {
    const changed = proposed.map((p) => p.dayName ?? p.day).join(', ');
    if (!(await confirmApply(`El coach propone cambios en: ${changed}. ¿Aplicar a tu plan?`))) return;
    setApplyingIndex(index);
    const err = await save(applyProposed(days, proposed));
    setApplyingIndex(null);
    if (err) { Alert.alert('Error al aplicar', err); return; }
    setApplied((prev) => new Set(prev).add(index));
  }, [days, save]);

  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
    const isUser = item.role === 'user';
    const { clean, proposed } = isUser ? { clean: item.content, proposed: null } : extractPlanUpdate(item.content);
    return (
      <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
        {!isUser && (
          <View style={[s.avatar, { backgroundColor: colors.accent }]}>
            <Text style={s.avatarText}>C</Text>
          </View>
        )}
        <View
          style={[
            s.bubbleContent,
            isUser
              ? { backgroundColor: colors.text }
              : { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
          ]}
        >
          <Text style={[s.messageText, { color: isUser ? colors.card : colors.text }]}>
            {clean}
          </Text>

          {proposed && (
            applied.has(index) ? (
              <Text style={[s.appliedText, { color: colors.accent }]}>✓ Plan actualizado</Text>
            ) : (
              <TouchableOpacity
                style={[s.applyBtn, { backgroundColor: colors.accent }]}
                onPress={() => handleApply(index, proposed)}
                disabled={applyingIndex === index}
                activeOpacity={0.8}
              >
                <Text style={s.applyBtnText}>
                  {applyingIndex === index ? 'Aplicando...' : 'Aplicar al plan'}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    );
  }

  if (initializing) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[s.loadingText, { color: colors.text3 }]}>Cargando conversación...</Text>
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
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={s.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {loading && (
          <View style={s.typing}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[s.typingText, { color: colors.text3 }]}>Coach escribiendo...</Text>
          </View>
        )}

        <View style={[s.inputRow, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="Pregunta al coach..."
            multiline
            containerStyle={s.inputContainer}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            maxLength={600}
          />
          <Button
            label="↑"
            onPress={handleSend}
            disabled={!input.trim() || loading}
            style={[
              s.sendBtn,
              { backgroundColor: !input.trim() || loading ? colors.border : colors.text },
            ]}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.gapMd },
  loadingText: { fontSize: FontSize.md },
  messageList: { padding: Spacing.lg, paddingBottom: Spacing.gapSm },

  bubble: { flexDirection: 'row', marginBottom: Spacing.base, alignItems: 'flex-end' },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.gapSm,
    marginBottom: 2,
  },
  avatarText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.black },

  bubbleContent: {
    maxWidth: '78%',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapMd,
    borderRadius: Radius.lg,
  },
  messageText: { fontSize: FontSize.body, lineHeight: 22 },
  applyBtn: {
    marginTop: Spacing.gapSm,
    paddingVertical: Spacing.gapSm,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  appliedText: { marginTop: Spacing.gapSm, fontSize: FontSize.base, fontWeight: FontWeight.heavy },

  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.gapSm,
    gap: Spacing.gapSm,
  },
  typingText: { fontSize: FontSize.md },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderTopWidth: 0.5,
    gap: Spacing.gapMd,
  },
  inputContainer: { flex: 1 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});

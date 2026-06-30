import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { getColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { askGroq } from '../../lib/groq';
import { supabase } from '../../lib/supabase';
import { ChatMessage, TrainingSession, DayPlan } from '../../types';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { getCurrentWeek } from '../../hooks/useTraining';
import { usePlan } from '../../lib/PlanContext';

const GREETING: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy tu coach de IA. He cargado tu historial de entrenamiento reciente. ¿En qué puedo ayudarte?',
};

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

  const planSummary = days
    .map((d) => `- ${d.dayName}: ${d.title} (${SESSION_LABELS[d.sessionType] ?? d.sessionType}, ${d.duration} min)`)
    .join('\n');

  return `Eres el coach personal de un atleta de 23 años que se prepara para una media maratón y Hyrox posteriormente.
El atleta entrena 7 días a la semana: running, natación y gimnasio (énfasis Hyrox).
Estás en la semana ${weekNumber} del ciclo de entrenamiento.

HOY ES: ${todayStr}. La sesión programada para hoy es: ${todaySession}.
No deduzcas el día por tu cuenta; usa siempre esta fecha como "hoy".

ÚLTIMAS SESIONES REGISTRADAS:
${sessionSummary}

PLAN SEMANAL ACTUAL DEL ATLETA (puede haberlo editado, úsalo como fuente de verdad):
${planSummary}

INSTRUCCIONES:
- Responde siempre en español, de forma concisa y práctica.
- Basa tus respuestas en el contexto de sesiones recientes cuando sea relevante.
- Cuando hagas ajustes al plan, explica brevemente el razonamiento fisiológico.
- Tono motivador pero realista. Máximo 180 palabras por respuesta salvo que te pidan más detalle.`;
}

// ─── Conversation screen ──────────────────────────────────────────────────────
export default function ConversationScreen() {
  const colors = getColors(useColorScheme());
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { days } = usePlan();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [recentSessions, setRecentSessions] = useState<TrainingSession[]>([]);
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

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === 'user';
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
            {item.content}
          </Text>
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

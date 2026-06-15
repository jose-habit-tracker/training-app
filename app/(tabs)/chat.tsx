import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { getColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { askGroq } from '../../lib/groq';
import { supabase } from '../../lib/supabase';
import { ChatMessage, TrainingSession } from '../../types';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { getCurrentWeek } from '../../hooks/useTraining';

// ─── Build system prompt with recent session context ──────────────────────────
function buildSystemPrompt(recentSessions: TrainingSession[]): string {
  const weekNumber = getCurrentWeek();

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

  return `Eres el coach personal de un atleta de 23 años que se prepara para una media maratón en octubre 2025 y Hyrox posteriormente.
El atleta entrena 7 días a la semana: running, natación y gimnasio (énfasis Hyrox).
Estás en la semana ${weekNumber} del ciclo de entrenamiento.

ÚLTIMAS SESIONES REGISTRADAS:
${sessionSummary}

PLAN SEMANAL:
- Lunes: Running umbral (60 min)
- Martes: Natación técnica (45 min)
- Miércoles: Fuerza + movilidad (70 min)
- Jueves: Intervalos VO2max (55 min)
- Viernes: Hyrox circuit (65 min)
- Sábado: Tirada larga (100 min)
- Domingo: Recuperación activa (30 min)

INSTRUCCIONES:
- Responde siempre en español, de forma concisa y práctica.
- Basa tus respuestas en el contexto de sesiones recientes cuando sea relevante.
- Cuando hagas ajustes al plan, explica brevemente el razonamiento fisiológico.
- Tono motivador pero realista. Máximo 180 palabras por respuesta salvo que te pidan más detalle.`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const colors = getColors(useColorScheme());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState('');
  const listRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);

  // ── Load conversation history + build context from Supabase ──
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setInitializing(false); return; }
      userIdRef.current = user.id;

      // Last 3 sessions for context
      const { data: sessions } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false })
        .limit(3);

      const prompt = buildSystemPrompt((sessions ?? []) as TrainingSession[]);
      setSystemPrompt(prompt);

      // Last 20 conversation messages
      const { data: history } = await supabase
        .from('ai_conversations')
        .select('role, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(20);

      const historyMessages = (history ?? []) as ChatMessage[];

      if (historyMessages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: '¡Hola! Soy tu coach de IA. He cargado tu historial de entrenamiento reciente. ¿En qué puedo ayudarte?',
        }]);
      } else {
        setMessages(historyMessages);
      }

      setInitializing(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const persistMessage = useCallback(async (msg: ChatMessage) => {
    if (!userIdRef.current) return;
    await supabase.from('ai_conversations').insert({
      user_id: userIdRef.current,
      role: msg.role,
      content: msg.content,
    });
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    await persistMessage(userMsg);

    try {
      // Only send last 10 messages to Groq to stay within token limits
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
  }, [input, loading, messages, systemPrompt, persistMessage]);

  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
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
          <Text style={[s.loadingText, { color: colors.text3 }]}>Cargando historial...</Text>
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

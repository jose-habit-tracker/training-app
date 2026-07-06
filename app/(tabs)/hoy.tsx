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
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { usePlan } from '../../lib/PlanContext';
import { useToday, getPhaseLabel } from '../../hooks/useTraining';
import { useRecorder } from '../../hooks/useRecorder';
import { buildGreeting } from '../../lib/coach/greeting';
import { buildCoachSystemPrompt, DAY_MAP } from '../../lib/coach/context';
import { askCoach, transcribeAudio } from '../../lib/coach/api';
import { executeProposal } from '../../lib/coach/actions';
import type { ActionProposal } from '../../lib/coach/types';
import { ChatMessage, TrainingSession } from '../../types';
import { MessageBubble } from '../../components/coach/MessageBubble';
import { ProposalCard, ProposalStatus } from '../../components/coach/ProposalCard';
import { ActionChips } from '../../components/coach/ActionChips';
import { CoachInput } from '../../components/coach/CoachInput';

interface ThreadItem {
  role: 'user' | 'assistant';
  content: string;
  proposal?: ActionProposal;
  proposalStatus?: ProposalStatus;
  proposalError?: string;
}

export default function HoyScreen() {
  const { colors } = useTheme();
  const { days, save } = usePlan();
  const { plan: todayPlan, weekNumber, dayKey, refresh } = useToday();
  const recorder = useRecorder();

  const [items, setItems] = useState<ThreadItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<TrainingSession[]>([]);
  const [busy, setBusy] = useState(false); // transcribiendo o esperando al coach
  const [busyLabel, setBusyLabel] = useState('');
  const [initializing, setInitializing] = useState(true);
  const listRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];
  const planToday = days.find((d) => d.day === DAY_MAP[new Date().getDay()]) ?? todayPlan;

  // ── Hilo del día: get-or-create en `conversations` + historial ───────────────
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

      const title = `Hoy · ${todayIso}`;
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', title)
        .limit(1)
        .maybeSingle();

      let convId = existing?.id as string | undefined;
      if (!convId) {
        const { data: created } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title })
          .select('id')
          .single();
        convId = created?.id;
      }
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

  // ── Enviar texto (escrito o transcrito) al coach ─────────────────────────────
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
      const systemPrompt = buildCoachSystemPrompt(days, recentSessions);
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
  }, [items, days, recentSessions, persist]);

  // ── Audio → transcripción → coach ────────────────────────────────────────────
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

  // ── Confirmar propuesta ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (index: number) => {
    const item = items[index];
    if (!item?.proposal) return;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, proposalStatus: 'applying' } : it)));

    const error = await executeProposal(item.proposal, { days, savePlan: save });

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
    refresh();
  }, [items, days, save, persist, refresh]);

  // ── Editar propuesta → formulario pre-rellenado ─────────────────────────────
  const handleEdit = useCallback((index: number) => {
    const p = items[index]?.proposal;
    if (!p || (p.action !== 'log_session' && p.action !== 'edit_session')) return;
    router.push({
      pathname: '/log/[day]',
      params: { day: dayKey, prefill: JSON.stringify(p.args), date: p.args.session_date },
    });
  }, [items, dayKey]);

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
              <View style={[s.weekChip, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                <Text style={[s.weekChipText, { color: colors.text3 }]}>
                  Semana {weekNumber} · {getPhaseLabel(weekNumber)}
                </Text>
              </View>
              <MessageBubble role="assistant" content={greeting} />
              {showChips && (
                <ActionChips
                  micSupported={recorder.supported}
                  onRecord={() => { void recorder.start(); }}
                  onManualLog={() => router.push({ pathname: '/log/[day]', params: { day: dayKey } })}
                  onViewPlan={() => router.push({ pathname: '/plan/[day]', params: { day: dayKey } })}
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
  weekChip: {
    alignSelf: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs,
    marginBottom: Spacing.base,
  },
  weekChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.gapSm,
    gap: Spacing.gapSm,
  },
  typingText: { fontSize: FontSize.md },
});

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { getColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { Conversation } from '../../types';
import { Button } from '../../components/ui/Button';

// Confirmación que funciona en web (window.confirm) y nativo (Alert)
function confirmDelete(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert('Eliminar conversación', message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function ChatListScreen() {
  const colors = getColors(useColorScheme());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setConversations((data ?? []) as Conversation[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleNew = useCallback(async () => {
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id })
      .select('id')
      .single();
    setCreating(false);
    if (error || !data) return;
    router.push(`/chat/${data.id}`);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirmDelete('¿Eliminar esta conversación? No se puede deshacer.'))) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('conversations').delete().eq('id', id);
  }, []);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={s.content}>
        <Button
          label={creating ? 'Creando...' : '+ Nueva conversación'}
          onPress={handleNew}
          disabled={creating}
          fullWidth
          style={s.newBtn}
        />

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={s.center}>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Sin conversaciones</Text>
            <Text style={[s.emptyText, { color: colors.text3 }]}>
              Crea una nueva para empezar a hablar con tu coach.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {conversations.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[s.row, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                onPress={() => router.push(`/chat/${c.id}`)}
                activeOpacity={0.8}
              >
                <View style={[s.avatar, { backgroundColor: colors.accent }]}>
                  <Text style={s.avatarText}>C</Text>
                </View>
                <View style={s.rowMain}>
                  <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{c.title}</Text>
                  <Text style={[s.date, { color: colors.text3 }]}>
                    {new Date(c.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(c.id)}
                  hitSlop={10}
                  style={s.deleteBtn}
                >
                  <Text style={[s.deleteText, { color: colors.danger }]}>Eliminar</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: Spacing.lg, gap: Spacing.lg },
  newBtn: {},
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.gapSm },
  emptyTitle: { fontSize: FontSize.body, fontWeight: FontWeight.black },
  emptyText: { fontSize: FontSize.md, textAlign: 'center', paddingHorizontal: Spacing.xxl },

  list: { gap: Spacing.gapSm, paddingBottom: Spacing.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.base,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: FontSize.body, fontWeight: FontWeight.black },
  rowMain: { flex: 1, gap: 2 },
  title: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  date: { fontSize: FontSize.base },
  deleteBtn: { paddingHorizontal: Spacing.gapSm, paddingVertical: Spacing.gapXs },
  deleteText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});

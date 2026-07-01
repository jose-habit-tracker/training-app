import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getColors } from '../constants/colors';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const GROQ_KEYS_URL = 'https://console.groq.com/keys';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function AjustesScreen() {
  const colors = getColors(useColorScheme());
  const [key, setKey] = useState('');
  const [savedMask, setSavedMask] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_ai_keys')
      .select('groq_key')
      .eq('user_id', user.id)
      .single();
    const k = data?.groq_key as string | undefined;
    setSavedMask(k ? `${k.slice(0, 6)}…${k.slice(-4)}` : null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = useCallback(async () => {
    const value = key.trim();
    if (!value.startsWith('gsk_')) {
      notify('Key no válida', 'Una API key de Groq empieza por "gsk_".');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from('user_ai_keys')
      .upsert({ user_id: user.id, groq_key: value, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { notify('Error al guardar', error.message); return; }
    setKey('');
    setSavedMask(`${value.slice(0, 6)}…${value.slice(-4)}`);
    notify('Guardado', 'Tu API key de Groq está lista. Ya puedes usar el coach.');
  }, [key]);

  const handleDelete = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_ai_keys').delete().eq('user_id', user.id);
    setSavedMask(null);
  }, []);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={[s.h1, { color: colors.text }]}>Tu API key de Groq</Text>
        <Text style={[s.body, { color: colors.text3 }]}>
          El coach usa tu propia cuenta de Groq (gratis). Crea una key y pégala aquí; solo tú puedes verla.
        </Text>

        <TouchableOpacity onPress={() => Linking.openURL(GROQ_KEYS_URL)} activeOpacity={0.7}>
          <Text style={[s.link, { color: colors.accent }]}>Conseguir una key en console.groq.com/keys →</Text>
        </TouchableOpacity>

        {!loading && savedMask && (
          <View style={[s.statusCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <Text style={[s.statusLabel, { color: colors.text3 }]}>Key configurada</Text>
            <Text style={[s.statusValue, { color: colors.text }]}>{savedMask}</Text>
            <TouchableOpacity onPress={handleDelete} hitSlop={8} style={s.deleteBtn}>
              <Text style={[s.deleteText, { color: colors.danger }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.form}>
          <Input
            label={savedMask ? 'Reemplazar key' : 'Pega tu key'}
            value={key}
            onChangeText={setKey}
            placeholder="gsk_..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Button
            label={saving ? 'Guardando...' : 'Guardar'}
            onPress={handleSave}
            loading={saving}
            disabled={!key.trim()}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.base },
  h1: { fontSize: FontSize.body, fontWeight: FontWeight.black },
  body: { fontSize: FontSize.md, lineHeight: 20 },
  link: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  statusCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.base,
    gap: 2,
  },
  statusLabel: { fontSize: FontSize.base },
  statusValue: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  deleteBtn: { position: 'absolute', right: Spacing.base, top: Spacing.base },
  deleteText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  form: { gap: Spacing.base, marginTop: Spacing.gapSm },
});

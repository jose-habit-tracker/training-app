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

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const colors = getColors(useColorScheme());

  async function handleRegister() {
    if (!email || !password || !confirm) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    const { data: invite } = await supabase
      .from('user_invites')
      .select('*')
      .eq('email', email.toLowerCase())
      .is('used_at', null)
      .single();

    if (!invite) {
      setLoading(false);
      Alert.alert('Acceso restringido', 'Esta app es invite-only. Contacta al administrador.');
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert('Error', error.message);
      return;
    }

    await supabase
      .from('user_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('email', email.toLowerCase());

    setLoading(false);
    Alert.alert('Cuenta creada', 'Revisa tu email para confirmar el registro.');
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.text }]}>Crear cuenta</Text>
        <Text style={[styles.subtitle, { color: colors.text3 }]}>
          App de acceso por invitación
        </Text>

        <View style={styles.form}>
          <Input
            label="Email (debe tener invitación)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="tu@email.com"
          />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••"
          />
          <Input
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="••••••"
          />

          <Button
            label="Registrarse"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            style={styles.submitBtn}
          />

          <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
            <Text style={[styles.linkText, { color: colors.accent }]}>
              ← Volver al login
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.black,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.section,
  },
  form: {
    gap: Spacing.gapMd,
  },
  submitBtn: {
    marginTop: Spacing.gapSm,
    alignSelf: 'stretch',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.base,
  },
  linkText: {
    fontSize: FontSize.md,
  },
});

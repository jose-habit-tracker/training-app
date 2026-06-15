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
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    // Alert.alert is a no-op on web
    return;
  }
  Alert.alert(title, message);
}

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const colors = getColors(useColorScheme());

  async function handleRegister() {
    console.log('[Register] submit triggered', { email });
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password || !confirm) {
      setErrorMsg('Completa todos los campos');
      showAlert('Error', 'Completa todos los campos');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden');
      showAlert('Error', 'Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres');
      showAlert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      console.log('[Register] checking invite for', email.toLowerCase());

      const { data: invite, error: inviteError } = await supabase
        .from('user_invites')
        .select('*')
        .eq('email', email.toLowerCase())
        .is('used_at', null)
        .single();

      console.log('[Register] invite result:', { invite, inviteError });

      if (inviteError || !invite) {
        const msg = inviteError
          ? `Error al verificar invitación: ${inviteError.message}`
          : 'Esta app es invite-only. Contacta al administrador.';
        setErrorMsg(msg);
        showAlert('Acceso restringido', msg);
        setLoading(false);
        return;
      }

      console.log('[Register] invite valid, signing up...');

      const { error: signUpError } = await supabase.auth.signUp({ email, password });

      console.log('[Register] signUp result:', { signUpError });

      if (signUpError) {
        setErrorMsg(`Error al crear cuenta: ${signUpError.message}`);
        showAlert('Error', signUpError.message);
        setLoading(false);
        return;
      }

      await supabase
        .from('user_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('email', email.toLowerCase());

      const msg = 'Cuenta creada. Revisa tu email para confirmar el registro.';
      setSuccessMsg(msg);
      showAlert('Cuenta creada', msg);
      setLoading(false);

      setTimeout(() => router.replace('/(auth)/login'), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      console.error('[Register] unexpected error:', err);
      setErrorMsg(`Error inesperado: ${msg}`);
      setLoading(false);
    }
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
            onChangeText={(v) => { setEmail(v); setErrorMsg(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="tu@email.com"
          />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={(v) => { setPassword(v); setErrorMsg(null); }}
            secureTextEntry
            placeholder="••••••"
          />
          <Input
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setErrorMsg(null); }}
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

          {errorMsg && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}

          {successMsg && (
            <Text style={styles.successText}>{successMsg}</Text>
          )}

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
  errorText: {
    color: '#ff453a',
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 4,
  },
  successText: {
    color: '#30d158',
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 4,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.base,
  },
  linkText: {
    fontSize: FontSize.md,
  },
});

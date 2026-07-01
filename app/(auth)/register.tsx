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
import { Turnstile } from '../../components/Turnstile';

const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const colors = getColors(useColorScheme());

  const captchaRequired = !!TURNSTILE_SITE_KEY;

  // Los tokens de Turnstile son de un solo uso: tras un intento hay que pedir
  // uno nuevo remontando el widget, o el siguiente envío da timeout-or-duplicate.
  function resetCaptcha() {
    setCaptchaToken('');
    setCaptchaKey((k) => k + 1);
  }

  async function handleRegister() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim() || !email || !password || !confirm) {
      setErrorMsg('Completa todos los campos');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (captchaRequired && !captchaToken) {
      setErrorMsg('Verificación de seguridad en curso, espera un momento.');
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: name.trim() }, captchaToken: captchaToken || undefined },
      });

      if (error) {
        setErrorMsg(error.message);
        if (Platform.OS !== 'web') Alert.alert('Error', error.message);
        resetCaptcha();
        setLoading(false);
        return;
      }

      setSuccessMsg('Cuenta creada. Ya puedes iniciar sesión.');
      setLoading(false);

      setTimeout(() => router.replace('/(auth)/login'), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMsg(`Error inesperado: ${msg}`);
      resetCaptcha();
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
          Crea tu cuenta para empezar
        </Text>

        <View style={styles.form}>
          <Input
            label="Nombre"
            value={name}
            onChangeText={(v) => { setName(v); setErrorMsg(null); }}
            autoCapitalize="words"
            autoCorrect={false}
            placeholder="Tu nombre"
          />
          <Input
            label="Email"
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

          {captchaRequired && (
            <Turnstile key={captchaKey} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />
          )}

          <Button
            label="Registrarse"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            style={styles.submitBtn}
          />

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          {successMsg && <Text style={styles.successText}>{successMsg}</Text>}

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
  container: { flex: 1 },
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
  form: { gap: Spacing.gapMd },
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
  linkText: { fontSize: FontSize.md },
});

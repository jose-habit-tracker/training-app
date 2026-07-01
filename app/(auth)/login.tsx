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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const colors = getColors(useColorScheme());

  const captchaRequired = Platform.OS === 'web' && !!TURNSTILE_SITE_KEY;

  // Token de un solo uso: tras cada intento remontamos el widget para uno nuevo.
  function resetCaptcha() {
    setCaptchaToken('');
    setCaptchaKey((k) => k + 1);
  }

  async function handleLogin() {
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Por favor completa todos los campos');
      if (Platform.OS !== 'web') Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }
    if (captchaRequired && !captchaToken) {
      setErrorMsg('Verificación de seguridad en curso, espera un momento.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken || undefined },
    });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      if (Platform.OS !== 'web') Alert.alert('Error de acceso', error.message);
      resetCaptcha();
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={[styles.logo, { color: colors.text }]}>Training</Text>
        <Text style={[styles.subtitle, { color: colors.text3 }]}>
          Media Maratón · Hyrox
        </Text>

        <View style={styles.form}>
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

          {captchaRequired && (
            <Turnstile key={captchaKey} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />
          )}

          <Button
            label="Entrar"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            style={styles.submitBtn}
          />

          {errorMsg && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={[styles.linkText, { color: colors.accent }]}>
              ¿No tienes cuenta? Regístrate
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
  logo: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.black,
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.section,
    letterSpacing: 0.5,
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
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.base,
  },
  linkText: {
    fontSize: FontSize.md,
  },
});

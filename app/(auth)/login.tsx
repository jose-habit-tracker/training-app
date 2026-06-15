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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const colors = getColors(useColorScheme());

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Error de acceso', error.message);
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

          <Button
            label="Entrar"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            style={styles.submitBtn}
          />

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
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.base,
  },
  linkText: {
    fontSize: FontSize.md,
  },
});

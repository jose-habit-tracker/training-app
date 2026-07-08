import { useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { PlanProvider, usePlan } from '../lib/PlanContext';
import { ThemeProvider } from '../lib/ThemeContext';
import { useTheme } from '../hooks/useTheme';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={eb.container}>
          <ScrollView contentContainerStyle={eb.scroll}>
            <Text style={eb.title}>Algo ha ido mal</Text>
            <Text style={eb.message}>
              La app ha encontrado un error inesperado. Cierra y vuelve a abrirla; si persiste, contacta con soporte.
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, paddingTop: 60 },
  title: { color: '#ff453a', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  message: { color: '#fff', fontSize: 14, marginBottom: 16, lineHeight: 20 },
});

function NavigationGuard() {
  const { session, initialized } = useAuth();
  const { loading, hasPlan } = usePlan();
  // Depender del id (no del objeto session) evita re-disparar la redirección
  // en cada TOKEN_REFRESHED y sacar al usuario de un onboarding relanzado.
  const userId = session?.user?.id;

  useEffect(() => {
    if (!initialized) return;
    if (!userId) {
      router.replace('/(auth)/login');
      return;
    }
    if (loading) return;
    router.replace(hasPlan ? '/(tabs)/hoy' : '/onboarding');
  }, [userId, initialized, loading, hasPlan]);

  return null;
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ThemeProvider>
            <PlanProvider>
              <ThemedStatusBar />
              <NavigationGuard />
              <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen
                name="log/[day]"
                options={{
                  headerShown: true,
                  headerTitle: 'Registrar sesión',
                  headerBackTitle: 'Atrás',
                }}
              />
              <Stack.Screen
                name="plan/index"
                options={{
                  headerShown: true,
                  headerTitle: 'Editar plan',
                  headerBackTitle: 'Atrás',
                }}
              />
              <Stack.Screen
                name="plan/[day]"
                options={{
                  headerShown: true,
                  headerTitle: 'Editar día',
                  headerBackTitle: 'Atrás',
                }}
              />
              <Stack.Screen
                name="chat/[id]"
                options={{
                  headerShown: true,
                  headerTitle: 'Coach IA',
                  headerBackTitle: 'Conversaciones',
                }}
              />
              <Stack.Screen
                name="ajustes"
                options={{
                  headerShown: true,
                  headerTitle: 'Ajustes',
                  headerBackTitle: 'Atrás',
                }}
              />
              </Stack>
            </PlanProvider>
          </ThemeProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

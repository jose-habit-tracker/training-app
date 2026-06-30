import { useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { PlanProvider } from '../lib/PlanContext';

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
            <Text style={eb.title}>Error de inicio</Text>
            <Text style={eb.message}>{(error as Error).message}</Text>
            <Text style={eb.stack}>{(error as Error).stack}</Text>
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
  message: { color: '#fff', fontSize: 14, marginBottom: 16 },
  stack: { color: '#888', fontSize: 11, lineHeight: 16 },
});

function NavigationGuard() {
  const { session, initialized } = useAuth();

  useEffect(() => {
    if (!initialized) return;
    router.replace(session ? '/(tabs)/hoy' : '/(auth)/login');
  }, [session, initialized]);

  return null;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <PlanProvider>
            <StatusBar style="auto" />
            <NavigationGuard />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
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
            </Stack>
          </PlanProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

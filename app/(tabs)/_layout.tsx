import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ColorValue, useColorScheme } from 'react-native';
import { getColors } from '../../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IoniconName; color: ColorValue }) {
  return <Ionicons name={name} size={22} color={color as string} />;
}

export default function TabsLayout() {
  const colors = getColors(useColorScheme());

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="hoy"
        options={{
          title: 'Hoy',
          headerTitle: 'Entrenamiento de hoy',
          tabBarIcon: ({ color }) => <TabIcon name="flame" color={color} />,
        }}
      />
      <Tabs.Screen
        name="semana"
        options={{
          title: 'Semana',
          headerTitle: 'Vista semanal',
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Coach IA',
          headerTitle: 'Coach IA',
          tabBarIcon: ({ color }) => <TabIcon name="chatbubble" color={color} />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          headerTitle: 'Historial',
          tabBarIcon: ({ color }) => <TabIcon name="bar-chart" color={color} />,
        }}
      />
    </Tabs>
  );
}

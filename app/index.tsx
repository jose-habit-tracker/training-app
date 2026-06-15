import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { getColors } from '../constants/colors';

export default function Index() {
  const colors = getColors(useColorScheme());
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

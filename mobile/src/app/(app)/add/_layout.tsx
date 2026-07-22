import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function CaptureLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="transaction" options={{ headerShown: true, title: 'Add transaction' }} />
    </Stack>
  );
}

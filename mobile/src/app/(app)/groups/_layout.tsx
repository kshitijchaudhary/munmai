import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerShown: true,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerShadowVisible: false,
    }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Spaces' }} />
      <Stack.Screen name="[groupId]/index" options={{ title: 'Space' }} />
      <Stack.Screen name="[groupId]/add-expense" options={{ title: 'Add shared expense' }} />
      <Stack.Screen name="[groupId]/settlements/index" options={{ title: 'Settlements' }} />
      <Stack.Screen name="[groupId]/settlements/new" options={{ title: 'Record settlement' }} />
    </Stack>
  );
}

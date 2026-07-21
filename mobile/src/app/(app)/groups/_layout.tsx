import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerShadowVisible: false,
    }}>
      <Stack.Screen name="index" options={{ title: 'Groups' }} />
      <Stack.Screen name="[groupId]/index" options={{ title: 'Group' }} />
      <Stack.Screen name="[groupId]/add-expense" options={{ title: 'Add shared expense' }} />
    </Stack>
  );
}

import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/auth-context';
import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/constants/theme';
import { getAuthExitTransition } from '@/navigation/routes';
import { transactionDataRefresh } from '@/transactions/transaction-data-refresh';

function AuthNavigator() {
  const { restoreError, retryRestoration, signOut, status } = useAuth();
  const router = useRouter();
  const previousStatus = useRef(status);

  useEffect(() => {
    const transition = getAuthExitTransition(previousStatus.current, status);
    previousStatus.current = status;

    if (transition?.method === 'replace') {
      router.replace(transition.target);
    }
  }, [router, status]);

  if (status === 'restoring') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centeredScreen}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>M</Text>
        </View>
        <Text style={styles.title}>Munmai</Text>
        <Text style={styles.message}>Restoring your session…</Text>
      </View>
    );
  }

  if (status === 'restore-error') {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.eyebrow}>MUNMAI</Text>
        <Text style={styles.title}>We could not restore your session</Text>
        <Text accessibilityLiveRegion="assertive" style={styles.message}>
          {restoreError}
        </Text>
        <View style={styles.actions}>
          <PrimaryButton label="Retry" onPress={() => void retryRestoration()} />
          <PrimaryButton label="Sign out" onPress={() => void signOut()} tone="neutral" />
        </View>
      </View>
    );
  }

  const isAuthenticated = status === 'authenticated';

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="register" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="add-transaction" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => () => transactionDataRefresh.clear(), []);

  return (
    <AuthProvider>
      <AuthNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  brandMark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  brandLetter: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  title: {
    maxWidth: 420,
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    maxWidth: 420,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
    marginTop: 12,
  },
});

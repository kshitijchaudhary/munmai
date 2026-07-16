import { Link, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { colors } from '@/constants/theme';

export default function SignInScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.brandBlock}>
              <View style={styles.brandMark}>
                <Text style={styles.brandLetter}>M</Text>
              </View>
              <Text style={styles.brand}>Munmai</Text>
              <Text style={styles.tagline}>Your money, made clearer.</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to continue tracking your day.</Text>
              </View>

              <View style={styles.fields}>
                <TextField
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  label="Email *"
                  placeholder="you@example.com"
                />
                <TextField
                  autoCapitalize="none"
                  autoComplete="current-password"
                  label="Password *"
                  placeholder="Enter your password"
                  secureTextEntry
                />
              </View>

              <PrimaryButton label="Sign In" onPress={() => router.replace('/dashboard')} />

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>New to Munmai?</Text>
                <Link href="/register" asChild>
                  <Pressable accessibilityRole="link" hitSlop={8}>
                    <Text style={styles.link}>Create an account</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 32,
    paddingHorizontal: 20,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.accent,
    marginBottom: 4,
  },
  brandLetter: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
  },
  brand: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 16,
  },
  card: {
    gap: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 22,
  },
  cardHeading: {
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  fields: {
    gap: 16,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});

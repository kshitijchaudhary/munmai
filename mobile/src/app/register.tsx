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

export default function RegisterScreen() {
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
            <View style={styles.heading}>
              <View style={styles.eyebrowRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandLetter}>M</Text>
                </View>
                <Text style={styles.brand}>Munmai</Text>
              </View>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>A simple place to understand your everyday money.</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.fields}>
                <TextField autoComplete="name" label="Name *" placeholder="Your name" />
                <TextField
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  label="Email *"
                  placeholder="you@example.com"
                />
                <TextField
                  autoCapitalize="none"
                  autoComplete="new-password"
                  label="Password *"
                  placeholder="Create a password"
                  secureTextEntry
                />
                <TextField
                  autoCapitalize="none"
                  autoComplete="new-password"
                  label="Confirm password *"
                  placeholder="Enter it again"
                  secureTextEntry
                />
              </View>

              <PrimaryButton
                label="Create account"
                onPress={() => router.replace('/dashboard')}
              />

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Link href="/sign-in" asChild>
                  <Pressable accessibilityRole="link" hitSlop={8}>
                    <Text style={styles.link}>Sign In</Text>
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
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 28,
    paddingHorizontal: 20,
  },
  heading: {
    gap: 8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  brandMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.accent,
  },
  brandLetter: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  brand: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    maxWidth: 360,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    gap: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 22,
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

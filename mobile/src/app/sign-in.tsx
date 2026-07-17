import { Link, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
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

import { getErrorMessage } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { colors } from '@/constants/theme';

type SignInField = 'email' | 'password';
type SignInErrors = Partial<Record<SignInField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { registrationMessage } = useLocalSearchParams<{ registrationMessage?: string }>();
  const { authMessage, clearAuthMessage, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<SignInErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInProgress = useRef(false);

  const validate = () => {
    const nextErrors: SignInErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (submissionInProgress.current || !validate()) {
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setRequestError(null);
    clearAuthMessage();

    try {
      await signIn({ email, password });
    } catch (error) {
      setRequestError(getErrorMessage(error, 'Unable to sign in. Please try again.'));
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  };

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

              {registrationMessage ? (
                <View style={styles.successNotice}>
                  <Text accessibilityLiveRegion="polite" style={styles.successTitle}>
                    {registrationMessage}
                  </Text>
                  <Text style={styles.noticeCopy}>Verify your email before signing in.</Text>
                </View>
              ) : null}

              {authMessage ? (
                <View style={styles.infoNotice}>
                  <Text accessibilityLiveRegion="assertive" style={styles.noticeCopy}>
                    {authMessage}
                  </Text>
                </View>
              ) : null}

              {requestError ? (
                <View style={styles.errorNotice}>
                  <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
                    {requestError}
                  </Text>
                </View>
              ) : null}

              <View style={styles.fields}>
                <TextField
                  autoCapitalize="none"
                  autoComplete="email"
                  error={errors.email}
                  keyboardType="email-address"
                  label="Email *"
                  onChangeText={(value) => {
                    setEmail(value);
                    setErrors((current) => ({ ...current, email: undefined }));
                  }}
                  placeholder="you@example.com"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={email}
                />
                <TextField
                  autoCapitalize="none"
                  autoComplete="current-password"
                  error={errors.password}
                  label="Password *"
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  onSubmitEditing={() => void submit()}
                  placeholder="Enter your password"
                  returnKeyType="done"
                  secureTextEntry
                  textContentType="password"
                  value={password}
                />
              </View>

              <PrimaryButton
                disabled={isSubmitting}
                label="Sign In"
                loading={isSubmitting}
                loadingLabel="Signing in…"
                onPress={() => void submit()}
              />

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
  successNotice: {
    gap: 5,
    borderWidth: 1,
    borderColor: colors.income,
    borderRadius: 14,
    backgroundColor: colors.incomeSoft,
    padding: 14,
  },
  successTitle: {
    color: colors.income,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  infoNotice: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    padding: 14,
  },
  noticeCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  errorNotice: {
    borderWidth: 1,
    borderColor: colors.expense,
    borderRadius: 14,
    backgroundColor: colors.expenseSoft,
    padding: 14,
  },
  errorText: {
    color: colors.expense,
    fontSize: 14,
    lineHeight: 20,
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

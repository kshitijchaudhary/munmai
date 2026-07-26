import { Link } from 'expo-router';
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

import { requestPasswordReset } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import {
  FORGOT_PASSWORD_CONFIRMATION,
  validateForgotPasswordEmail,
} from '@/auth/forgot-password';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { colors } from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const submissionInProgress = useRef(false);

  const submit = async () => {
    if (submissionInProgress.current) {
      return;
    }

    const validationError = validateForgotPasswordEmail(email);
    setEmailError(validationError ?? undefined);

    if (validationError) {
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setRequestError(null);

    try {
      await requestPasswordReset(email);
      setIsComplete(true);
    } catch (error) {
      setRequestError(
        getErrorMessage(error, 'Unable to request a password reset. Please try again.'),
      );
    } finally {
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
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>MUNMAI</Text>
              <Text style={styles.title}>Forgot your password?</Text>
              <Text style={styles.subtitle}>
                Enter your email. The secure reset link will open Munmai on the web.
              </Text>
            </View>

            <View style={styles.card}>
              {isComplete ? (
                <View style={styles.successNotice}>
                  <Text style={styles.successTitle}>Check your email</Text>
                  <Text accessibilityLiveRegion="polite" style={styles.successText}>
                    {FORGOT_PASSWORD_CONFIRMATION}
                  </Text>
                </View>
              ) : (
                <>
                  {requestError ? (
                    <View style={styles.errorNotice}>
                      <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
                        {requestError}
                      </Text>
                    </View>
                  ) : null}

                  <TextField
                    autoCapitalize="none"
                    autoComplete="email"
                    error={emailError}
                    keyboardType="email-address"
                    label="Email *"
                    onChangeText={(value) => {
                      setEmail(value);
                      setEmailError(undefined);
                    }}
                    onSubmitEditing={() => void submit()}
                    placeholder="you@example.com"
                    returnKeyType="send"
                    textContentType="emailAddress"
                    value={email}
                  />

                  <PrimaryButton
                    disabled={isSubmitting}
                    label="Send reset link"
                    loading={isSubmitting}
                    loadingLabel="Sending…"
                    onPress={() => void submit()}
                  />
                </>
              )}

              <Link href={PUBLIC_ROUTES.signIn} replace asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ pressed }) => [
                    styles.backLink,
                    pressed && styles.backLinkPressed,
                  ]}>
                  <Text style={styles.backLinkText}>Back to Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 24,
    paddingHorizontal: 20,
  },
  heading: { gap: 8 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  card: {
    gap: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 22,
  },
  successNotice: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.income,
    borderRadius: 14,
    backgroundColor: colors.incomeSoft,
    padding: 14,
  },
  successTitle: { color: colors.income, fontSize: 16, fontWeight: '800' },
  successText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  errorNotice: {
    borderWidth: 1,
    borderColor: colors.expense,
    borderRadius: 14,
    backgroundColor: colors.expenseSoft,
    padding: 14,
  },
  errorText: { color: colors.expense, fontSize: 14, lineHeight: 20 },
  backLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  backLinkPressed: { backgroundColor: colors.accentSoft },
  backLinkText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});

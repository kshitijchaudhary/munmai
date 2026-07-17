import { Link, useRouter } from 'expo-router';
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
import { isNormalizedApiError } from '@/auth/types';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { colors } from '@/constants/theme';

type RegisterField = 'name' | 'email' | 'username' | 'password' | 'confirmPassword';
type RegisterErrors = Partial<Record<RegisterField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInProgress = useRef(false);

  const validate = () => {
    const nextErrors: RegisterErrors = {};
    const normalizedEmail = email.trim();
    const normalizedUsername = username.trim();

    if (!name.trim()) {
      nextErrors.name = 'Name is required.';
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!normalizedUsername) {
      nextErrors.username = 'Username is required.';
    } else if (normalizedUsername.length < 3) {
      nextErrors.username = 'Username must be at least 3 characters.';
    } else if (!USERNAME_PATTERN.test(normalizedUsername)) {
      nextErrors.username = 'Use only letters, numbers, and underscores.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords must match.';
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

    try {
      const response = await register({ name, email, username, password, confirmPassword });

      router.replace({
        pathname: '/sign-in',
        params: { registrationMessage: response.message },
      });
    } catch (error) {
      if (isNormalizedApiError(error) && error.status === 502) {
        setRequestError(
          'Your account may have been created, but the verification email could not be delivered. Check your inbox, then try registering again later if no email arrives.',
        );
      } else {
        setRequestError(getErrorMessage(error, 'Unable to create your account. Please try again.'));
      }
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
              <View style={styles.eyebrowRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandLetter}>M</Text>
                </View>
                <Text style={styles.brand}>Munmai</Text>
              </View>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                Create your account, then verify your email before signing in.
              </Text>
            </View>

            <View style={styles.card}>
              {requestError ? (
                <View style={styles.errorNotice}>
                  <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
                    {requestError}
                  </Text>
                </View>
              ) : null}

              <View style={styles.fields}>
                <TextField
                  autoComplete="name"
                  error={errors.name}
                  label="Name *"
                  onChangeText={(value) => {
                    setName(value);
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                  placeholder="Your name"
                  textContentType="name"
                  value={name}
                />
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
                  textContentType="emailAddress"
                  value={email}
                />
                <TextField
                  autoCapitalize="none"
                  autoComplete="username-new"
                  error={errors.username}
                  label="Username *"
                  onChangeText={(value) => {
                    setUsername(value);
                    setErrors((current) => ({ ...current, username: undefined }));
                  }}
                  placeholder="jane_doe"
                  textContentType="username"
                  value={username}
                />
                <TextField
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={errors.password}
                  label="Password *"
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  placeholder="Create a password"
                  secureTextEntry
                  textContentType="newPassword"
                  value={password}
                />
                <TextField
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={errors.confirmPassword}
                  label="Confirm password *"
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setErrors((current) => ({ ...current, confirmPassword: undefined }));
                  }}
                  onSubmitEditing={() => void submit()}
                  placeholder="Enter it again"
                  returnKeyType="done"
                  secureTextEntry
                  textContentType="newPassword"
                  value={confirmPassword}
                />
              </View>

              <PrimaryButton
                disabled={isSubmitting}
                label="Create account"
                loading={isSubmitting}
                loadingLabel="Creating account…"
                onPress={() => void submit()}
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

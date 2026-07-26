export const FORGOT_PASSWORD_CONFIRMATION =
  'If an account exists, a password reset email has been sent.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateForgotPasswordEmail(email: string): string | null {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return 'Email is required.';
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return 'Enter a valid email address.';
  }

  return null;
}

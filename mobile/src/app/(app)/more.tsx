import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { ScreenHeader } from '@/components/screen-header';
import { SurfaceCard } from '@/components/surface-card';
import {
  colors,
  fontWeights,
  radii,
  spacing,
  touchTargets,
  typography,
} from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';

export default function AccountScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.name.trim() || 'Munmai user';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(PUBLIC_ROUTES.home as Href);
  };

  const handleSignOut = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    void signOut();
  };

  return (
    <ScreenContainer>
      <ScreenHeader
        action={
          <Pressable
            accessibilityLabel="Close account"
            accessibilityRole="button"
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}>
            <Text style={styles.closeLabel}>Done</Text>
          </Pressable>
        }
        eyebrow="Account"
        subtitle="Your profile and session controls."
        title="Your Munmai profile"
      />

      <SurfaceCard>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.username}>
              {user?.username ? `@${user.username}` : 'No username'}
            </Text>
          </View>
        </View>

        <View style={styles.details}>
          <Text style={styles.detailLabel}>Email</Text>
          <Text numberOfLines={2} style={styles.detailValue}>
            {user?.email || 'Unavailable'}
          </Text>
        </View>

        <PrimaryButton
          disabled={isSigningOut}
          label="Sign out"
          loading={isSigningOut}
          loadingLabel="Signing out…"
          onPress={handleSignOut}
          tone="neutral"
        />
      </SurfaceCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  closeButtonPressed: { opacity: 0.68 },
  closeLabel: { color: colors.accent, fontSize: typography.body, fontWeight: fontWeights.strong },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
  },
  avatarText: { color: colors.accent, fontSize: 24, fontWeight: fontWeights.heavy },
  identityCopy: { minWidth: 0, flex: 1, gap: spacing.xxs },
  name: { color: colors.text, fontSize: 21, fontWeight: fontWeights.heavy },
  username: { color: colors.textMuted, fontSize: typography.body },
  details: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: fontWeights.strong,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailValue: { color: colors.text, fontSize: typography.body, lineHeight: 20 },
});

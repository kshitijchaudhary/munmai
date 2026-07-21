import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';

export default function MoreScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.name.trim() || 'Munmai user';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleSignOut = () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    void signOut();
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>MORE</Text>
            <Text style={styles.title}>Your Munmai profile</Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.username}>{user?.username ? `@${user.username}` : 'No username'}</Text>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text numberOfLines={2} style={styles.detailValue}>
                  {user?.email || 'Unavailable'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account ID</Text>
                <Text numberOfLines={1} style={styles.detailValue}>
                  {user?.id || 'Unavailable'}
                </Text>
              </View>
            </View>

            <PrimaryButton
              disabled={isSigningOut}
              label="Sign out"
              loading={isSigningOut}
              loadingLabel="Signing out…"
              onPress={handleSignOut}
              tone="neutral"
            />
          </View>

          <Pressable
            accessibilityHint="Opens your shared group spaces"
            accessibilityRole="button"
            onPress={() => router.push(PUBLIC_ROUTES.groups as Href)}
            style={({ pressed }) => [styles.groupsCard, pressed && styles.groupsCardPressed]}>
            <View style={styles.groupsMark}><Text style={styles.groupsMarkText}>G</Text></View>
            <View style={styles.groupsCopy}>
              <Text style={styles.groupsTitle}>Groups</Text>
              <Text style={styles.groupsSubtitle}>Shared spending, balances, and members</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
    paddingTop: 24,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 26,
    paddingHorizontal: 20,
  },
  heading: {
    gap: 7,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  profileCard: {
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 22,
  },
  groupsCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 16,
  },
  groupsCardPressed: { opacity: 0.72 },
  groupsMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accentSoft },
  groupsMarkText: { color: colors.accent, fontSize: 19, fontWeight: '900' },
  groupsCopy: { flex: 1, gap: 3 },
  groupsTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  groupsSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  chevron: { color: colors.textMuted, fontSize: 28 },
  avatar: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: '900',
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  username: {
    color: colors.textMuted,
    fontSize: 14,
  },
  details: {
    gap: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginVertical: 8,
  },
  detailRow: {
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    padding: 14,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { PrimaryButton } from '@/components/primary-button';
import { SummaryCard } from '@/components/summary-card';
import { colors } from '@/constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const currentMonth = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const displayName = user?.name.trim() || 'there';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleSignOut = () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    void signOut();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.greetingBlock}>
              <Text style={styles.eyebrow}>MUNMAI</Text>
              <Text style={styles.greeting}>Welcome back, {displayName}</Text>
              <Text style={styles.headerCopy}>Here is your money at a glance.</Text>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={styles.profileLabel}>
                  {user?.username ? `@${user.username}` : user?.email}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: isSigningOut, disabled: isSigningOut }}
                  disabled={isSigningOut}
                  hitSlop={8}
                  onPress={handleSignOut}>
                  <Text style={styles.signOut}>{isSigningOut ? 'Signing out…' : 'Sign out'}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>This month</Text>
              <Text style={styles.month}>{currentMonth}</Text>
            </View>
            <View style={styles.summaryRow}>
              <SummaryCard label="In" tone="income" value="$0.00" />
              <SummaryCard label="Out" tone="expense" value="$0.00" />
              <SummaryCard label="Net" tone="net" value="$0.00" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick add</Text>
            <View style={styles.actionRow}>
              <PrimaryButton
                label="Add income"
                onPress={() =>
                  router.push({ pathname: '/add-transaction', params: { type: 'income' } })
                }
                style={styles.actionButton}
                tone="income"
              />
              <PrimaryButton
                label="Add expense"
                onPress={() =>
                  router.push({ pathname: '/add-transaction', params: { type: 'expense' } })
                }
                style={styles.actionButton}
                tone="expense"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>+</Text>
              </View>
              <Text style={styles.emptyTitle}>Start with one transaction.</Text>
              <Text style={styles.emptyCopy}>Your recent activity will appear here.</Text>
            </View>
          </View>
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
    paddingVertical: 24,
  },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    gap: 30,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  greetingBlock: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  greeting: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  profileCard: {
    maxWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 10,
  },
  profileCopy: {
    flexShrink: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  profileLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  signOut: {
    color: colors.textMuted,
    fontSize: 12,
  },
  section: {
    gap: 14,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  month: {
    color: colors.textMuted,
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    marginBottom: 4,
  },
  emptyIconText: {
    color: colors.accent,
    fontSize: 25,
    fontWeight: '500',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

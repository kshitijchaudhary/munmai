import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';

export default function TransactionsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>TRANSACTIONS</Text>
            <Text style={styles.title}>Your money activity</Text>
            <Text style={styles.subtitle}>
              Transaction history will expand in a later release. For now, start a new entry here or review recent activity on Home.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.iconMark}>
              <Text style={styles.iconText}>+</Text>
            </View>
            <Text style={styles.cardTitle}>Add a transaction</Text>
            <Text style={styles.cardCopy}>
              Record income or an expense using the authenticated Munmai API.
            </Text>
            <PrimaryButton
              label="Open Add"
              onPress={() =>
                router.navigate({
                  pathname: PUBLIC_ROUTES.add,
                  params: { intent: String(Date.now()), type: 'expense' },
                })
              }
            />
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
    flexGrow: 1,
    paddingBottom: 30,
    paddingTop: 24,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 28,
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
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 22,
  },
  iconMark: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    marginBottom: 2,
  },
  iconText: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: '700',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
});

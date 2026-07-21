import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardStatusCard } from '@/components/dashboard-status-card';
import { TransactionDetailField } from '@/components/transaction-detail-field';
import { colors } from '@/constants/theme';
import { formatCurrency, formatTransactionDate } from '@/dashboard/dashboard-model';
import { PUBLIC_ROUTES } from '@/navigation/routes';
import { parseTransactionDetailRoute } from '@/transactions/transaction-routes';
import { useTransactionDetail } from '@/transactions/use-transaction-detail';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const params = parseTransactionDetailRoute(routeParams.type, routeParams.id);
  const { error, isOffline, record, retry, status } = useTransactionDetail(params);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(PUBLIC_ROUTES.transactions as unknown as Href);
  };

  const typeLabel = record?.type === 'income' ? 'Income' : 'Expense';
  const signedAmount = record
    ? `${record.type === 'income' ? '+' : '-'}${formatCurrency(record.amount)}`
    : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.shell}>
        <Pressable
          accessibilityLabel="Back to Activity"
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
          <Text style={styles.backText}>‹ Activity</Text>
        </Pressable>

        {status === 'loading' ? (
          <View style={styles.stateContent}>
            <DashboardStatusCard
              loading
              message="Loading this transaction securely."
              title="Loading transaction"
            />
          </View>
        ) : null}

        {status === 'invalid' || status === 'not-found' ? (
          <View style={styles.stateContent}>
            <DashboardStatusCard
              message="This transaction could not be found or is no longer available."
              title="Transaction unavailable"
            />
          </View>
        ) : null}

        {status === 'error' ? (
          <View style={styles.stateContent}>
            <DashboardStatusCard
              message={
                error ??
                (isOffline
                  ? 'Reconnect to load this transaction.'
                  : 'This transaction could not be loaded.')
              }
              onRetry={retry}
              title={isOffline ? "You're offline" : 'Transaction unavailable'}
            />
          </View>
        ) : null}

        {status === 'ready' && record ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View
                style={[
                  styles.typeBadge,
                  record.type === 'income' ? styles.incomeBadge : styles.expenseBadge,
                ]}>
                <Text
                  style={[
                    styles.typeBadgeText,
                    record.type === 'income' ? styles.incomeText : styles.expenseText,
                  ]}>
                  {typeLabel}
                </Text>
              </View>
              <Text
                accessibilityLabel={`${typeLabel} amount ${signedAmount}`}
                style={[
                  styles.amount,
                  record.type === 'income' ? styles.incomeText : styles.expenseText,
                ]}>
                {signedAmount}
              </Text>
              <Text numberOfLines={2} style={styles.title}>
                {record.title}
              </Text>
            </View>

            <View style={styles.detailCard}>
              <TransactionDetailField label="Type" value={typeLabel} />
              <TransactionDetailField
                label={record.type === 'income' ? 'Source' : 'Recipient'}
                value={record.title}
              />
              <TransactionDetailField label="Category" value={record.category} />
              <TransactionDetailField
                label="Date"
                value={formatTransactionDate(record.date)}
              />
              {record.type === 'expense' ? (
                <>
                  <TransactionDetailField
                    label="Expense type"
                    value={`${record.expenseType.charAt(0).toUpperCase()}${record.expenseType.slice(1)}`}
                  />
                  <TransactionDetailField
                    label="Deductible"
                    value={record.deductible ? 'Yes' : 'No'}
                  />
                  {record.deductible && record.deductiblePercent > 0 ? (
                    <TransactionDetailField
                      label="Deductible percent"
                      value={`${record.deductiblePercent}%`}
                    />
                  ) : null}
                  {record.taxCategory ? (
                    <TransactionDetailField
                      label="Tax category"
                      value={record.taxCategory}
                    />
                  ) : null}
                </>
              ) : null}
              {record.notes ? (
                <TransactionDetailField label="Notes" value={record.notes} />
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shell: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    alignSelf: 'center',
  },
  backButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: 12,
    marginLeft: 10,
    marginTop: 4,
    paddingHorizontal: 10,
  },
  backButtonPressed: {
    backgroundColor: colors.accentSoft,
    opacity: 0.75,
  },
  backText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  stateContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  scrollContent: {
    gap: 22,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hero: {
    alignItems: 'center',
    gap: 9,
    paddingVertical: 14,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  incomeBadge: {
    backgroundColor: colors.incomeSoft,
  },
  expenseBadge: {
    backgroundColor: colors.expenseSoft,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  title: {
    maxWidth: 420,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    textAlign: 'center',
  },
  detailCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  incomeText: {
    color: colors.income,
  },
  expenseText: {
    color: colors.expense,
  },
});

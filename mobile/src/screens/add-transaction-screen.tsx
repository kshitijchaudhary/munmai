import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
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
import { getHomeAfterTransactionTarget } from '@/navigation/routes';
import { type TransactionType } from '@/transactions/transaction-form';
import { useAddTransactionForm } from '@/transactions/use-add-transaction-form';

interface AddTransactionScreenProps {
  initialType: TransactionType;
}

const transactionTypes = ['income', 'expense'] as const;

export function AddTransactionScreen({ initialType }: AddTransactionScreenProps) {
  const router = useRouter();
  const handleSuccess = useCallback(
    (type: TransactionType) => {
      router.replace(getHomeAfterTransactionTarget(type) as unknown as Href);
    },
    [router],
  );
  const { errors, isSubmitting, requestError, selectType, submit, updateField, values } =
    useAddTransactionForm({ initialType, onSuccess: handleSuccess });
  const isIncome = values.type === 'income';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>NEW TRANSACTION</Text>
              <Text style={styles.title}>Add money in or out</Text>
              <Text style={styles.subtitle}>
                Save the essentials now. Munmai will update your Dashboard after the server confirms it.
              </Text>
            </View>

            <View style={styles.card}>
              {requestError ? (
                <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorNotice}>
                  <Text style={styles.errorText}>{requestError}</Text>
                </View>
              ) : null}

              <View style={styles.selectorGroup}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.selector}>
                  {transactionTypes.map((type) => {
                    const isSelected = values.type === type;
                    const selectedColor = type === 'income' ? colors.income : colors.expense;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isSubmitting, selected: isSelected }}
                        disabled={isSubmitting}
                        key={type}
                        onPress={() => selectType(type)}
                        style={({ pressed }) => [
                          styles.selectorButton,
                          isSelected && { backgroundColor: selectedColor },
                          pressed && !isSubmitting && styles.selectorPressed,
                        ]}>
                        <Text style={[styles.selectorText, isSelected && styles.selectorTextActive]}>
                          {type === 'income' ? 'Income' : 'Expense'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fields}>
                <TextField
                  editable={!isSubmitting}
                  error={errors.amount}
                  keyboardType="decimal-pad"
                  label="Amount *"
                  onChangeText={(value) => updateField('amount', value)}
                  placeholder="$0.00"
                  value={values.amount}
                />
                <TextField
                  editable={!isSubmitting}
                  error={errors.description}
                  label={isIncome ? 'Source *' : 'Vendor *'}
                  onChangeText={(value) => updateField('description', value)}
                  placeholder={isIncome ? 'Salary, client, or other source' : 'Store or service'}
                  value={values.description}
                />
                <TextField
                  autoCapitalize="none"
                  editable={!isSubmitting}
                  error={errors.date}
                  label="Date *"
                  onChangeText={(value) => updateField('date', value)}
                  onSubmitEditing={() => void submit()}
                  placeholder="YYYY-MM-DD"
                  returnKeyType="done"
                  value={values.date}
                />
              </View>

              <Text style={styles.helperText}>
                {isIncome
                  ? 'Income is saved in the Uncategorized category for now.'
                  : 'Expenses are saved as personal and non-deductible for now.'}
              </Text>

              <PrimaryButton
                disabled={isSubmitting}
                label={isIncome ? 'Save income' : 'Save expense'}
                loading={isSubmitting}
                loadingLabel="Saving transaction…"
                onPress={() => void submit()}
                tone={values.type}
              />
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
    paddingBottom: 30,
    paddingTop: 24,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 24,
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
    lineHeight: 20,
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
  selectorGroup: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selector: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    padding: 5,
  },
  selectorButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  selectorPressed: {
    opacity: 0.78,
  },
  selectorText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  selectorTextActive: {
    color: colors.background,
  },
  fields: {
    gap: 16,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});

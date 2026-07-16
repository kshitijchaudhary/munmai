import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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

type TransactionType = 'income' | 'expense';

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [transactionType, setTransactionType] = useState<TransactionType>(
    params.type === 'income' ? 'income' : 'expense',
  );

  const cancel = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/dashboard');
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
            <View style={styles.header}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>NEW TRANSACTION</Text>
                <Text style={styles.title}>Add a transaction</Text>
                <Text style={styles.subtitle}>Capture the essentials now. You can refine it later.</Text>
              </View>
              <Pressable accessibilityRole="button" hitSlop={10} onPress={cancel}>
                <Text style={styles.cancelTop}>Cancel</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.selectorGroup}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.selector}>
                  {(['income', 'expense'] as const).map((type) => {
                    const isSelected = transactionType === type;
                    const selectedColor = type === 'income' ? colors.income : colors.expense;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={type}
                        onPress={() => setTransactionType(type)}
                        style={[
                          styles.selectorButton,
                          isSelected && { backgroundColor: selectedColor },
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
                <TextField keyboardType="decimal-pad" label="Amount *" placeholder="$0.00" />
                <TextField label="Vendor or source *" placeholder="Who was this with?" />
                <TextField autoCapitalize="none" label="Date *" placeholder="YYYY-MM-DD" />
              </View>

              <View style={styles.actions}>
                <PrimaryButton
                  label="Save transaction"
                  onPress={() => router.replace('/dashboard')}
                  tone={transactionType}
                />
                <Pressable accessibilityRole="button" hitSlop={8} onPress={cancel}>
                  <Text style={styles.cancelBottom}>Cancel and go back</Text>
                </Pressable>
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
    paddingVertical: 28,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 26,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headingCopy: {
    flex: 1,
    gap: 6,
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
  cancelTop: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    paddingTop: 3,
  },
  card: {
    gap: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 22,
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
  actions: {
    gap: 16,
  },
  cancelBottom: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { PrimaryButton } from '@/components/primary-button';
import { ReceiptPickerField } from '@/components/receipt-picker-field';
import { TextField } from '@/components/text-field';
import { TransactionDateField } from '@/components/transaction-date-field';
import {
  colors,
  getFormBottomPadding,
  layout,
  radii,
  spacing,
} from '@/constants/theme';
import { getHomeAfterTransactionTarget } from '@/navigation/routes';
import type { ReceiptImage } from '@/receipts/receipt-image';
import { useReceiptPicker } from '@/receipts/use-receipt-picker';
import { shouldClearTransactionAttachment } from '@/transactions/transaction-attachment-copy';
import { type TransactionType } from '@/transactions/transaction-form';
import { requestOldTransactionConfirmation } from '@/transactions/transaction-old-date-confirmation';
import { useAddTransactionForm } from '@/transactions/use-add-transaction-form';

interface AddTransactionScreenProps {
  initialAttachment?: ReceiptImage | null;
  initialType: TransactionType;
  isCaptureTypeLocked?: boolean;
  onBack: () => void;
  onCaptureFinished?: () => void;
  onChangeCaptureType?: () => void;
}

const transactionTypes = ['income', 'expense'] as const;

export function AddTransactionScreen({
  initialAttachment = null,
  initialType,
  isCaptureTypeLocked = false,
  onBack,
  onCaptureFinished,
  onChangeCaptureType,
}: AddTransactionScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleSuccess = useCallback(
    (type: TransactionType) => {
      onCaptureFinished?.();
      router.replace(getHomeAfterTransactionTarget(type) as unknown as Href);
    },
    [onCaptureFinished, router],
  );
  const {
    discardPendingAttachment,
    errors,
    isFormLocked,
    isSubmitting,
    attachmentUploadFailed,
    requestError,
    retryAttachmentUpload,
    selectType,
    submissionStage,
    submit,
    updateField,
    values,
  } = useAddTransactionForm({
    confirmOldTransaction: requestOldTransactionConfirmation,
    initialType,
    onSuccess: handleSuccess,
  });
  const isIncome = values.type === 'income';
  const {
    choosePdf,
    chooseFromLibrary,
    isPicking,
    openSettings,
    permissionIssue,
    pickerError,
    receipt,
    removeReceipt,
    takePhoto,
  } = useReceiptPicker(
    isIncome ? 'income-proof' : 'receipt',
    initialAttachment,
  );
  const formDisabled = isSubmitting || isFormLocked;
  const loadingLabel =
    submissionStage === 'uploading-attachment'
      ? isIncome
        ? 'Uploading proof…'
        : 'Uploading receipt…'
      : isIncome
        ? 'Saving income…'
        : 'Saving expense…';

  const handleSelectType = useCallback(
    (type: TransactionType) => {
      if (shouldClearTransactionAttachment(values.type, type, receipt !== null)) {
        removeReceipt();
      }

      selectType(type);
    },
    [receipt, removeReceipt, selectType, values.type],
  );

  const handleDiscardPendingAttachment = useCallback(() => {
    discardPendingAttachment();
    removeReceipt();
    onCaptureFinished?.();
  }, [discardPendingAttachment, onCaptureFinished, removeReceipt]);

  const handleRemoveAttachment = useCallback(() => {
    removeReceipt();

    if (isCaptureTypeLocked) {
      onCaptureFinished?.();
    }
  }, [isCaptureTypeLocked, onCaptureFinished, removeReceipt]);

  const attachmentField = (
    <ReceiptPickerField
      disabled={formDisabled}
      isPicking={isPicking}
      onChooseFromLibrary={() => void chooseFromLibrary()}
      onChoosePdf={() => void choosePdf()}
      onOpenSettings={() => void openSettings()}
      onRemove={handleRemoveAttachment}
      onTakePhoto={() => void takePhoto()}
      permissionIssue={permissionIssue}
      pickerError={pickerError}
      receipt={receipt}
      transactionType={values.type}
    />
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <BackLink label="Capture" onPress={onBack} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: getFormBottomPadding(insets.bottom) },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.card}>
              {requestError ? (
                <View
                  accessibilityLiveRegion="assertive"
                  accessibilityRole="alert"
                  style={[
                    styles.errorNotice,
                    attachmentUploadFailed && styles.partialFailureNotice,
                  ]}>
                  {attachmentUploadFailed ? (
                    <Text style={styles.partialFailureTitle}>
                      {isIncome ? 'Income saved · proof pending' : 'Expense saved · receipt pending'}
                    </Text>
                  ) : null}
                  <Text
                    style={
                      attachmentUploadFailed ? styles.partialFailureText : styles.errorText
                    }>
                    {requestError}
                  </Text>
                </View>
              ) : null}

              {submissionStage === 'uploading-attachment' ? (
                <View accessibilityLiveRegion="polite" style={styles.progressNotice}>
                  <Text style={styles.progressTitle}>
                    {isIncome ? 'Income saved' : 'Expense saved'}
                  </Text>
                  <Text style={styles.progressText}>
                    {isIncome ? 'Uploading the income document now…' : 'Uploading the receipt now…'}
                  </Text>
                </View>
              ) : null}

              {isCaptureTypeLocked ? (
                <View style={styles.lockedTypeRow}>
                  <View style={styles.lockedTypeCopy}>
                    <Text style={styles.label}>Type</Text>
                    <Text style={styles.lockedTypeValue}>
                      {isIncome ? 'Income' : 'Expense'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Change transaction type"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: formDisabled }}
                    disabled={formDisabled}
                    onPress={onChangeCaptureType}
                    style={({ pressed }) => [
                      styles.changeTypeButton,
                      pressed && !formDisabled && styles.selectorPressed,
                    ]}>
                    <Text style={styles.changeTypeText}>Change</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.selectorGroup}>
                  <Text style={styles.label}>Type</Text>
                  <View style={styles.selector}>
                    {transactionTypes.map((type) => {
                      const isSelected = values.type === type;

                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: formDisabled,
                            selected: isSelected,
                          }}
                          disabled={formDisabled}
                          key={type}
                          onPress={() => handleSelectType(type)}
                          style={({ pressed }) => [
                            styles.selectorButton,
                            isSelected &&
                              (type === 'income'
                                ? styles.incomeSelectorButton
                                : styles.expenseSelectorButton),
                            pressed && !formDisabled && styles.selectorPressed,
                          ]}>
                          <Text
                            style={[
                              styles.selectorText,
                              isSelected && styles.selectorTextActive,
                            ]}>
                            {type === 'income' ? 'Income' : 'Expense'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.fields}>
                <TextField
                  editable={!formDisabled}
                  error={errors.amount}
                  keyboardType="decimal-pad"
                  label="Amount *"
                  onChangeText={(value) => updateField('amount', value)}
                  placeholder="$0.00"
                  value={values.amount}
                />
                <TextField
                  editable={!formDisabled}
                  error={errors.description}
                  label={isIncome ? 'Source *' : 'Vendor *'}
                  onChangeText={(value) => updateField('description', value)}
                  placeholder={
                    isIncome ? 'Salary, client, or other source' : 'Store or service'
                  }
                  value={values.description}
                />
                <TransactionDateField
                  disabled={formDisabled}
                  error={errors.date}
                  onChange={(value) => updateField('date', value)}
                  value={values.date}
                />
              </View>

              {attachmentField}

              <Text style={styles.helperText}>
                {isIncome
                  ? 'Income is saved in the Uncategorized category for now.'
                  : 'Expenses are saved as personal and non-deductible for now.'}
              </Text>

              {isFormLocked ? (
                <View style={styles.retryActions}>
                  <PrimaryButton
                    label={isIncome ? 'Retry proof upload' : 'Retry receipt upload'}
                    loading={isSubmitting}
                    loadingLabel={isIncome ? 'Uploading proof…' : 'Uploading receipt…'}
                    onPress={() => void retryAttachmentUpload()}
                    tone={values.type}
                  />
                  <Text style={styles.discardHelp}>
                    The {isIncome ? 'income' : 'expense'} is already saved. Discarding the
                    upload retry resets this form without deleting it.
                  </Text>
                  <Pressable
                    accessibilityLabel={
                      isIncome ? 'Discard proof upload retry' : 'Discard receipt upload retry'
                    }
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSubmitting }}
                    disabled={isSubmitting}
                    onPress={handleDiscardPendingAttachment}
                    style={({ pressed }) => [
                      styles.discardButton,
                      pressed && !isSubmitting && styles.discardButtonPressed,
                    ]}>
                    <Text style={styles.discardButtonText}>
                      {isIncome ? 'Discard proof upload retry' : 'Discard receipt upload retry'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <PrimaryButton
                  disabled={isSubmitting}
                  label={isIncome ? 'Save income' : 'Save expense'}
                  loading={isSubmitting}
                  loadingLabel={loadingLabel}
                  onPress={() => void submit(receipt)}
                  tone={values.type}
                />
              )}
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
    paddingTop: layout.pageTopPadding,
  },
  content: {
    width: '100%',
    maxWidth: layout.appShellMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.pageHorizontalPadding,
  },
  card: {
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
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
  partialFailureNotice: {
    gap: 5,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  partialFailureTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  partialFailureText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  progressNotice: {
    gap: 3,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    padding: 13,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  selectorGroup: {
    gap: 8,
  },
  lockedTypeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  lockedTypeCopy: {
    gap: 3,
  },
  lockedTypeValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  changeTypeButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  changeTypeText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
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
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  selectorPressed: {
    opacity: 0.78,
  },
  incomeSelectorButton: {
    backgroundColor: colors.income,
  },
  expenseSelectorButton: {
    backgroundColor: colors.expense,
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
  retryActions: {
    gap: 10,
  },
  discardHelp: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  discardButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
  },
  discardButtonPressed: {
    opacity: 0.72,
  },
  discardButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});

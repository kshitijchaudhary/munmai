import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, touchTargets } from '@/constants/theme';
import {
  createTransactionMonth,
  EARLIEST_TRANSACTION_MONTH,
  formatTransactionMonth,
  isSelectableTransactionMonth,
  shiftTransactionMonth,
} from '@/transactions/transaction-history-model';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

interface TransactionMonthSelectorProps {
  maximumMonth: string;
  onChange: (month: string) => void;
  value: string;
}

export function TransactionMonthSelector({
  maximumMonth,
  onChange,
  value,
}: TransactionMonthSelectorProps) {
  const previousDisabled = value <= EARLIEST_TRANSACTION_MONTH;
  const nextDisabled = value >= maximumMonth;
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [draftYear, setDraftYear] = useState(value.slice(0, 4));
  const [draftMonthNumber, setDraftMonthNumber] = useState(
    Number(value.slice(5, 7)),
  );
  const draftMonth = createTransactionMonth(draftYear, draftMonthNumber);
  const canConfirm =
    draftMonth !== null &&
    isSelectableTransactionMonth(draftMonth, maximumMonth);

  const openPicker = () => {
    setDraftYear(value.slice(0, 4));
    setDraftMonthNumber(Number(value.slice(5, 7)));
    setIsPickerVisible(true);
  };

  const cancelPicker = () => {
    setIsPickerVisible(false);
  };

  const selectMonth = (monthNumber: number) => {
    const monthValue = createTransactionMonth(draftYear, monthNumber);

    if (
      monthValue === null ||
      !isSelectableTransactionMonth(monthValue, maximumMonth)
    ) {
      return;
    }

    setIsPickerVisible(false);

    if (monthValue !== value) {
      onChange(monthValue);
    }
  };

  const pickerError =
    draftYear.length !== 4
      ? 'Enter a four-digit year.'
      : !canConfirm
        ? `Choose a month from ${formatTransactionMonth(EARLIEST_TRANSACTION_MONTH)} through ${formatTransactionMonth(maximumMonth)}.`
        : null;

  return (
    <>
      <View style={styles.container}>
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          accessibilityState={{ disabled: previousDisabled }}
          disabled={previousDisabled}
          onPress={() => onChange(shiftTransactionMonth(value, -1))}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            previousDisabled && styles.buttonDisabled,
          ]}>
          <Text style={styles.buttonText}>‹</Text>
        </Pressable>

        <Pressable
          accessibilityHint="Opens a month and year selector"
          accessibilityLabel={`Choose Activity month. Current selection ${formatTransactionMonth(value)}`}
          accessibilityRole="button"
          onPress={openPicker}
          style={({ pressed }) => [
            styles.copy,
            pressed && styles.copyPressed,
          ]}>
          <Text style={styles.caption}>MONTH</Text>
          <Text numberOfLines={1} style={styles.month}>
            {formatTransactionMonth(value)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          onPress={() => onChange(shiftTransactionMonth(value, 1))}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            nextDisabled && styles.buttonDisabled,
          ]}>
          <Text style={styles.buttonText}>›</Text>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={cancelPicker}
        transparent
        visible={isPickerVisible}>
        <KeyboardAvoidingView
          accessibilityViewIsModal
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : Platform.OS === 'android'
                ? 'height'
                : undefined
          }
          style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={cancelPicker}
                style={({ pressed }) => [
                  styles.modalAction,
                  pressed && styles.actionPressed,
                ]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text accessibilityRole="header" style={styles.modalTitle}>
                Choose month
              </Text>
              <View style={styles.modalAction} />
            </View>

            <ScrollView
              contentContainerStyle={styles.pickerContent}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.pickerScroll}>
              <View style={styles.yearField}>
                <Text style={styles.yearLabel}>YEAR</Text>
                <TextInput
                  accessibilityLabel="Activity year"
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(year) =>
                    setDraftYear(year.replace(/\D/g, ''))
                  }
                  selectTextOnFocus
                  style={styles.yearInput}
                  value={draftYear}
                />
              </View>

              <View accessibilityRole="radiogroup" style={styles.monthGrid}>
                {MONTHS.map((month, index) => {
                  const monthNumber = index + 1;
                  const monthValue = createTransactionMonth(
                    draftYear,
                    monthNumber,
                  );
                  const disabled =
                    monthValue === null ||
                    !isSelectableTransactionMonth(monthValue, maximumMonth);
                  const selected = draftMonthNumber === monthNumber;

                  return (
                    <Pressable
                      accessibilityLabel={`${month}${draftYear.length === 4 ? ` ${draftYear}` : ''}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled }}
                      disabled={disabled}
                      key={month}
                      onPress={() => selectMonth(monthNumber)}
                      style={({ pressed }) => [
                        styles.monthOption,
                        selected && styles.monthOptionSelected,
                        pressed && styles.actionPressed,
                        disabled && styles.actionDisabled,
                      ]}>
                      <Text
                        style={[
                          styles.monthOptionText,
                          selected && styles.monthOptionTextSelected,
                        ]}>
                        {month.slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {pickerError ? (
                <Text accessibilityLiveRegion="polite" style={styles.pickerError}>
                  {pickerError}
                </Text>
              ) : (
                <Text style={styles.pickerHint}>
                  Activity is available through {formatTransactionMonth(maximumMonth)}.
                </Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.surface,
    padding: 4,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.surfaceRaised,
  },
  buttonPressed: {
    backgroundColor: colors.accentSoft,
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 34,
  },
  copy: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  copyPressed: {
    backgroundColor: colors.accentSoft,
  },
  caption: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  month: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 8, 20, 0.72)',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 10,
  },
  modalAction: {
    minWidth: 68,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 8,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  pickerContent: {
    gap: 18,
    padding: 18,
  },
  pickerScroll: {
    flexShrink: 1,
  },
  yearField: {
    gap: 7,
  },
  yearLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  yearInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthOption: {
    minWidth: '30%',
    minHeight: touchTargets.minimum,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  monthOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  monthOptionText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  monthOptionTextSelected: {
    color: colors.accent,
  },
  pickerError: {
    color: colors.expense,
    fontSize: 12,
    lineHeight: 17,
  },
  pickerHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.38,
  },
});

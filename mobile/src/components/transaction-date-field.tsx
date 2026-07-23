import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, touchTargets } from '@/constants/theme';
import {
  formatTransactionDateValue,
  getLocalDateFromValue,
  getLocalDateValue,
  getMinimumTransactionDateValue,
  resolveTransactionDateSelection,
} from '@/transactions/transaction-form';

interface TransactionDateFieldProps {
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
  value: string;
}

function getTodayAtNoon(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
}

export function TransactionDateField({
  disabled = false,
  error,
  onChange,
  value,
}: TransactionDateFieldProps) {
  const selectedDate = getLocalDateFromValue(value) ?? getTodayAtNoon();
  const maximumDate = getTodayAtNoon();
  const minimumDate =
    getLocalDateFromValue(getMinimumTransactionDateValue(maximumDate)) ?? maximumDate;
  const [isIOSPickerVisible, setIsIOSPickerVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(selectedDate);

  const openPicker = () => {
    if (disabled) {
      return;
    }

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'default',
        maximumDate,
        minimumDate,
        mode: 'date',
        negativeButton: { label: 'Cancel' },
        onDismiss: () => undefined,
        onValueChange: (_event, date) => {
          onChange(resolveTransactionDateSelection(value, date));
        },
        positiveButton: { label: 'Done' },
        value: selectedDate,
      });
      return;
    }

    setDraftDate(selectedDate);
    setIsIOSPickerVisible(true);
  };

  const closeIOSPicker = () => setIsIOSPickerVisible(false);
  const commitIOSDate = () => {
    onChange(getLocalDateValue(draftDate));
    setIsIOSPickerVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Date *</Text>
      <Pressable
        accessibilityHint="Opens the transaction date calendar"
        accessibilityLabel={`Transaction date, ${formatTransactionDateValue(value)}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.field,
          error && styles.fieldError,
          pressed && !disabled && styles.fieldPressed,
          disabled && styles.fieldDisabled,
        ]}>
        <Text style={styles.value}>{formatTransactionDateValue(value)}</Text>
        <SymbolView name="calendar" size={21} tintColor={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          animationType="fade"
          onRequestClose={closeIOSPicker}
          transparent
          visible={isIOSPickerVisible}>
          <View accessibilityViewIsModal style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={closeIOSPicker}
                  style={({ pressed }) => [styles.modalAction, pressed && styles.fieldPressed]}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>Transaction date</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={commitIOSDate}
                  style={({ pressed }) => [styles.modalAction, pressed && styles.fieldPressed]}>
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                display="spinner"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                mode="date"
                onValueChange={(_event, date) => setDraftDate(date)}
                themeVariant="dark"
                value={draftDate}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldError: {
    borderColor: colors.expense,
  },
  fieldPressed: {
    opacity: 0.72,
  },
  fieldDisabled: {
    opacity: 0.55,
  },
  value: {
    color: colors.text,
    fontSize: 16,
  },
  error: {
    color: colors.expense,
    fontSize: 13,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 8, 20, 0.72)',
  },
  modalCard: {
    borderTopWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    paddingBottom: 24,
  },
  modalHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
  },
  modalAction: {
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  doneText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
});

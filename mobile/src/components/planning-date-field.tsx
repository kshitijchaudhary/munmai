import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, touchTargets } from '@/constants/theme';
import { dateValueToLocalNoon, formatCalendarDate, getTodayCalendarDate, localDateToValue } from '@/planning/planning-model';

interface PlanningDateFieldProps {
  allowClear?: boolean;
  disabled?: boolean;
  error?: string;
  label: string;
  minimumToday?: boolean;
  onChange: (value: string) => void;
  value: string;
}

const todayAtNoon = () => dateValueToLocalNoon(getTodayCalendarDate()) ?? new Date();

export function PlanningDateField({
  allowClear = false,
  disabled = false,
  error,
  label,
  minimumToday = false,
  onChange,
  value,
}: PlanningDateFieldProps) {
  const selectedDate = dateValueToLocalNoon(value) ?? todayAtNoon();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(selectedDate);
  const formattedValue = value ? formatCalendarDate(value, true) : 'Choose a date';

  const openPicker = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'default',
        minimumDate: minimumToday ? todayAtNoon() : undefined,
        mode: 'date',
        negativeButton: { label: 'Cancel' },
        onDismiss: () => undefined,
        onValueChange: (_event, date) => onChange(localDateToValue(date)),
        positiveButton: { label: 'Done' },
        value: selectedDate,
      });
      return;
    }
    setDraftDate(selectedDate);
    setPickerVisible(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}, ${formattedValue}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [styles.field, error && styles.fieldError, pressed && styles.pressed, disabled && styles.disabled]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{formattedValue}</Text>
        <SymbolView name="calendar" size={21} tintColor={colors.textMuted} />
      </Pressable>
      {allowClear && value ? (
        <Pressable accessibilityRole="button" onPress={() => onChange('')} style={styles.clearButton}>
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      ) : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal animationType="fade" onRequestClose={() => setPickerVisible(false)} transparent visible={pickerVisible}>
          <View accessibilityViewIsModal style={styles.backdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Pressable accessibilityRole="button" onPress={() => setPickerVisible(false)} style={styles.modalAction}><Text style={styles.cancel}>Cancel</Text></Pressable>
                <Text style={styles.modalTitle}>{label}</Text>
                <Pressable accessibilityRole="button" onPress={() => { onChange(localDateToValue(draftDate)); setPickerVisible(false); }} style={styles.modalAction}><Text style={styles.done}>Done</Text></Pressable>
              </View>
              <DateTimePicker display="spinner" minimumDate={minimumToday ? todayAtNoon() : undefined} mode="date" onValueChange={(_event, date) => setDraftDate(date)} themeVariant="dark" value={draftDate} />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, paddingVertical: 12 },
  fieldError: { borderColor: colors.expense },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
  value: { color: colors.text, fontSize: 16 },
  placeholder: { color: colors.textMuted },
  clearButton: { minHeight: touchTargets.minimum, alignSelf: 'flex-start', justifyContent: 'center' },
  clearText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  error: { color: colors.expense, fontSize: 13, lineHeight: 18 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3, 8, 20, 0.72)' },
  modalCard: { borderTopWidth: 1, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, paddingBottom: 24 },
  modalHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: 12 },
  modalAction: { minWidth: touchTargets.minimum, minHeight: touchTargets.minimum, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  modalTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cancel: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  done: { color: colors.accent, fontSize: 15, fontWeight: '800' },
});

import { SymbolView } from 'expo-symbols';
import { type ChangeEvent, type CSSProperties, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatCalendarDate, getTodayCalendarDate } from '@/planning/planning-model';

interface PlanningDateFieldProps {
  allowClear?: boolean;
  disabled?: boolean;
  embeddedIOS?: boolean;
  error?: string;
  label: string;
  minimumToday?: boolean;
  onChange: (value: string) => void;
  value: string;
}

const inputStyle: CSSProperties = { appearance: 'none', border: 0, cursor: 'pointer', height: '100%', inset: 0, margin: 0, opacity: 0, padding: 0, position: 'absolute', width: '100%' };

export function PlanningDateField({ disabled = false, error, label, minimumToday = false, onChange, value }: PlanningDateFieldProps) {
  const [focused, setFocused] = useState(false);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value);
  const formatted = value ? formatCalendarDate(value, true) : 'Choose a date';
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.focused, error && styles.errorField, disabled && styles.disabled]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{formatted}</Text>
        <SymbolView name="calendar" size={21} tintColor={colors.textMuted} />
        <input aria-invalid={Boolean(error)} aria-label={`${label}, ${formatted}`} disabled={disabled} min={minimumToday ? getTodayCalendarDate() : undefined} onBlur={() => setFocused(false)} onChange={handleChange} onFocus={() => setFocused(true)} style={inputStyle} type="date" value={value} />
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 }, label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  field: { position: 'relative', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, paddingVertical: 12 },
  focused: { borderColor: colors.accent }, errorField: { borderColor: colors.expense }, disabled: { opacity: 0.55 },
  value: { color: colors.text, fontSize: 16 }, placeholder: { color: colors.textMuted }, error: { color: colors.expense, fontSize: 13, lineHeight: 18 },
});

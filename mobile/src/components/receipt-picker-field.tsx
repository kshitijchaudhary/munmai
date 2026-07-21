import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { ReceiptImage } from '@/receipts/receipt-image';
import type { ReceiptPermissionIssue } from '@/receipts/use-receipt-picker';

interface ReceiptPickerFieldProps {
  disabled: boolean;
  isPicking: boolean;
  onChooseFromLibrary: () => void;
  onOpenSettings: () => void;
  onRemove: () => void;
  onTakePhoto: () => void;
  permissionIssue: ReceiptPermissionIssue | null;
  pickerError: string | null;
  receipt: ReceiptImage | null;
}

function formatFileSize(fileSize: number | null): string {
  if (fileSize === null) {
    return 'Size will be checked by the server';
  }

  return `${(fileSize / (1024 * 1024)).toFixed(2)} MB`;
}

export function ReceiptPickerField({
  disabled,
  isPicking,
  onChooseFromLibrary,
  onOpenSettings,
  onRemove,
  onTakePhoto,
  permissionIssue,
  pickerError,
  receipt,
}: ReceiptPickerFieldProps) {
  const actionsDisabled = disabled || isPicking;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.label}>Receipt</Text>
          <Text style={styles.optional}>OPTIONAL</Text>
        </View>
        <Text style={styles.helper}>One JPEG or PNG image, up to 5 MB.</Text>
      </View>

      {permissionIssue ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeText}>{permissionIssue.message}</Text>
          {permissionIssue.canOpenSettings ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSettings}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.buttonPressed]}>
              <Text style={styles.settingsButtonText}>Open settings</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {pickerError ? (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorNotice}>
          <Text style={styles.errorText}>{pickerError}</Text>
        </View>
      ) : null}

      {receipt ? (
        <View style={styles.previewCard}>
          <Image
            accessibilityLabel={`Selected receipt ${receipt.fileName}`}
            resizeMode="cover"
            source={{ uri: receipt.uri }}
            style={styles.preview}
          />
          <View style={styles.previewCopy}>
            <Text numberOfLines={1} style={styles.fileName}>
              {receipt.fileName}
            </Text>
            <Text style={styles.fileMeta}>{formatFileSize(receipt.fileSize)}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyPreview}>
          <Text style={styles.emptyMark}>▧</Text>
          <Text style={styles.emptyTitle}>No receipt selected</Text>
          <Text style={styles.emptyCopy}>You can save this expense without one.</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: actionsDisabled }}
          disabled={actionsDisabled}
          onPress={onTakePhoto}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.buttonPressed,
            actionsDisabled && styles.buttonDisabled,
          ]}>
          <Text style={styles.actionButtonText}>
            {isPicking ? 'Opening…' : receipt ? 'Replace photo' : 'Take photo'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: actionsDisabled }}
          disabled={actionsDisabled}
          onPress={onChooseFromLibrary}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.buttonPressed,
            actionsDisabled && styles.buttonDisabled,
          ]}>
          <Text style={styles.actionButtonText}>
            {isPicking
              ? 'Opening…'
              : receipt
                ? 'Replace from library'
                : 'Choose from library'}
          </Text>
        </Pressable>
      </View>

      {receipt ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled }}
          disabled={disabled}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}>
          <Text style={styles.removeButtonText}>Remove receipt</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 20,
  },
  heading: {
    gap: 5,
  },
  headingCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  optional: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  notice: {
    gap: 9,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    padding: 12,
  },
  noticeText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  settingsButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: 11,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
  },
  settingsButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  errorNotice: {
    borderWidth: 1,
    borderColor: colors.expense,
    borderRadius: 14,
    backgroundColor: colors.expenseSoft,
    padding: 12,
  },
  errorText: {
    color: colors.expense,
    fontSize: 12,
    lineHeight: 18,
  },
  previewCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    padding: 10,
  },
  preview: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  previewCopy: {
    minWidth: 0,
    flex: 1,
    gap: 5,
  },
  fileName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  fileMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyPreview: {
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyMark: {
    color: colors.accent,
    fontSize: 25,
    fontWeight: '900',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  removeButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: 11,
    paddingHorizontal: 10,
  },
  removeButtonText: {
    color: colors.expense,
    fontSize: 12,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.42,
  },
});

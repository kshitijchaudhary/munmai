import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import {
  formatSupportingDocumentFileSize,
  getSupportingDocumentDisplayModel,
  type ReceiptImage,
} from '@/receipts/receipt-image';
import type { ReceiptPermissionIssue } from '@/receipts/use-receipt-picker';
import {
  getTransactionAttachmentAccessibilityLabel,
  getTransactionAttachmentCopy,
} from '@/transactions/transaction-attachment-copy';
import type { TransactionType } from '@/transactions/transaction-form';

interface ReceiptPickerFieldProps {
  disabled: boolean;
  isPicking: boolean;
  onChooseFromLibrary: () => void;
  onChoosePdf: () => void;
  onOpenSettings: () => void;
  onRemove: () => void;
  onTakePhoto: () => void;
  permissionIssue: ReceiptPermissionIssue | null;
  pickerError: string | null;
  receipt: ReceiptImage | null;
  transactionType: TransactionType;
}

export function ReceiptPickerField({
  disabled,
  isPicking,
  onChooseFromLibrary,
  onChoosePdf,
  onOpenSettings,
  onRemove,
  onTakePhoto,
  permissionIssue,
  pickerError,
  receipt,
  transactionType,
}: ReceiptPickerFieldProps) {
  const [isPickerMenuVisible, setIsPickerMenuVisible] = useState(false);
  const actionsDisabled = disabled || isPicking;
  const copy = getTransactionAttachmentCopy(transactionType);
  const display = receipt ? getSupportingDocumentDisplayModel(receipt) : null;
  const pickerActions = [
    { action: onTakePhoto, label: copy.takePhotoLabel },
    { action: onChooseFromLibrary, label: copy.chooseFromLibraryLabel },
    { action: onChoosePdf, label: copy.choosePdfLabel },
  ];

  const selectPickerAction = (action: () => void) => {
    setIsPickerMenuVisible(false);
    action();
  };

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.label}>{copy.addLabel}</Text>
          <Text style={styles.optional}>OPTIONAL</Text>
        </View>
        <Text style={styles.constraints}>{copy.constraints}</Text>
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
          {display?.preview === 'pdf' ? (
            <View
              accessibilityLabel={getTransactionAttachmentAccessibilityLabel(
                transactionType,
                receipt.fileName,
              )}
              style={styles.pdfPreview}>
              <Text style={styles.pdfMark}>PDF</Text>
            </View>
          ) : (
            <Image
              accessibilityLabel={getTransactionAttachmentAccessibilityLabel(
                transactionType,
                receipt.fileName,
              )}
              resizeMode="cover"
              source={{ uri: receipt.uri }}
              style={styles.preview}
            />
          )}
          <View style={styles.previewCopy}>
            <Text numberOfLines={1} style={styles.fileName}>{display?.fileName}</Text>
            <Text style={styles.fileMeta}>
              {formatSupportingDocumentFileSize(receipt.fileSize)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyPreview}>
          <Text style={styles.emptyMark}>▧</Text>
          <Text style={styles.emptyTitle}>{copy.emptyLabel}</Text>
        </View>
      )}

      <Pressable
        accessibilityLabel={`${receipt ? 'Replace' : 'Choose'} ${copy.noun}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: actionsDisabled }}
        disabled={actionsDisabled}
        onPress={() => setIsPickerMenuVisible(true)}
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.buttonPressed,
          actionsDisabled && styles.buttonDisabled,
        ]}>
        <Text style={styles.actionButtonText}>
          {isPicking ? 'Opening…' : `${receipt ? 'Replace' : 'Choose'} ${copy.noun}`}
        </Text>
      </Pressable>

      {receipt ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}>
          <Text style={styles.removeButtonText}>{copy.removeLabel}</Text>
        </Pressable>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setIsPickerMenuVisible(false)}
        transparent
        visible={isPickerMenuVisible}>
        <View accessibilityViewIsModal style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{copy.addLabel}</Text>
            {pickerActions.map(({ action, label }) => (
              <Pressable
                accessibilityRole="button"
                key={label}
                onPress={() => selectPickerAction(action)}
                style={({ pressed }) => [styles.modalAction, pressed && styles.buttonPressed]}>
                <Text style={styles.modalActionText}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsPickerMenuVisible(false)}
              style={({ pressed }) => [styles.modalCancel, pressed && styles.buttonPressed]}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 20 },
  heading: { gap: 5 },
  headingCopy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.text, fontSize: 15, fontWeight: '800' },
  optional: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  constraints: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  notice: { gap: 9, borderWidth: 1, borderColor: colors.accent, borderRadius: 14, backgroundColor: colors.accentSoft, padding: 12 },
  noticeText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  settingsButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 11, backgroundColor: colors.surfaceRaised, paddingHorizontal: 14 },
  settingsButtonText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  errorNotice: { borderWidth: 1, borderColor: colors.expense, borderRadius: 14, backgroundColor: colors.expenseSoft, padding: 12 },
  errorText: { color: colors.expense, fontSize: 12, lineHeight: 18 },
  previewCard: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surfaceRaised, padding: 10 },
  preview: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.background },
  pdfPreview: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accentSoft },
  pdfMark: { color: colors.accent, fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  previewCopy: { minWidth: 0, flex: 1, gap: 5 },
  fileName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  fileMeta: { color: colors.textMuted, fontSize: 11 },
  emptyPreview: { alignItems: 'center', gap: 5, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, paddingVertical: 18 },
  emptyMark: { color: colors.accent, fontSize: 25, fontWeight: '900' },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  actionButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surfaceRaised, paddingHorizontal: 12, paddingVertical: 8 },
  actionButtonText: { color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  removeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 11, paddingHorizontal: 10 },
  removeButtonText: { color: colors.expense, fontSize: 12, fontWeight: '800' },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.42 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3, 8, 20, 0.72)', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surface, padding: 16 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '900', paddingBottom: 4 },
  modalAction: { minHeight: 48, justifyContent: 'center', borderRadius: 13, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16 },
  modalActionText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  modalCancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, marginTop: 4 },
  modalCancelText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
});

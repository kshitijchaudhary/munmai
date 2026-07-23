import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCaptureActions, type CaptureActionId } from '@/capture/capture-actions';
import { useCaptureDraft } from '@/capture/capture-draft-context';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { ScreenHeader } from '@/components/screen-header';
import {
  borders,
  colors,
  fontWeights,
  radii,
  shadows,
  spacing,
  touchTargets,
  typography,
} from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';
import { useReceiptPicker } from '@/receipts/use-receipt-picker';
import type { TransactionType } from '@/transactions/transaction-form';

const captureActions = getCaptureActions(PUBLIC_ROUTES);
const [scanAction, manualAction] = captureActions;

const actionIcons: Record<CaptureActionId, ComponentProps<typeof SymbolView>['name']> = {
  'scan-document': { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  'manual-entry': { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' },
};

const typeOptions: readonly TransactionType[] = ['expense', 'income'];

export default function CaptureScreen() {
  const router = useRouter();
  const {
    clearDraft,
    createDraft,
    draft,
    replaceDraftAttachment,
    setDraftType,
  } = useCaptureDraft();
  const {
    isPicking,
    openSettings,
    permissionIssue,
    pickerError,
    removeReceipt,
    takePhoto,
  } = useReceiptPicker('receipt');

  useEffect(() => {
    if (!draft) {
      removeReceipt();
    }
  }, [draft, removeReceipt]);

  const capturePhoto = async () => {
    const capturedAttachment = await takePhoto();

    if (!capturedAttachment) {
      return;
    }

    if (draft) {
      replaceDraftAttachment(draft.id, capturedAttachment);
      return;
    }

    createDraft(capturedAttachment);
  };

  const resetCapture = () => {
    clearDraft();
    removeReceipt();
  };

  const openManualEntry = () => {
    resetCapture();
    router.navigate({
      pathname: manualAction.pathname,
      params: { intent: String(Date.now()) },
    } as unknown as Href);
  };

  const continueWithCapture = () => {
    if (!draft?.transactionType) {
      return;
    }

    router.navigate({
      pathname: PUBLIC_ROUTES.transactionForm,
      params: { draft: draft.id, intent: draft.id, type: draft.transactionType },
    } as unknown as Href);
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={draft ? 'Review your document' : 'Capture & go'} />

      {draft ? (
        <View style={styles.reviewCard}>
          <Image
            accessibilityLabel="Captured transaction document"
            resizeMode="contain"
            source={{ uri: draft.attachment.uri }}
            style={styles.preview}
          />

          <View style={styles.reviewCopy}>
            <Text style={styles.reviewTitle}>What type of transaction is this?</Text>
            <Text style={styles.reviewDescription}>
              Choose a type before continuing. You can edit every field on the next screen.
            </Text>
          </View>

          <View accessibilityRole="radiogroup" style={styles.typeSelector}>
            {typeOptions.map((type) => {
              const isSelected = draft.transactionType === type;

              return (
                <Pressable
                  accessibilityLabel={type === 'expense' ? 'Expense' : 'Income'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: isPicking }}
                  disabled={isPicking}
                  key={type}
                  onPress={() => setDraftType(draft.id, type)}
                  style={({ pressed }) => [
                    styles.typeButton,
                    isSelected &&
                      (type === 'expense' ? styles.expenseSelected : styles.incomeSelected),
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.typeLabel,
                      isSelected && styles.selectedTypeLabel,
                    ]}>
                    {type === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton
            disabled={!draft.transactionType || isPicking}
            label="Continue"
            onPress={continueWithCapture}
            tone={draft.transactionType ?? 'accent'}
          />

          <View style={styles.reviewActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: isPicking, disabled: isPicking }}
              disabled={isPicking}
              onPress={() => void capturePhoto()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>
                {isPicking ? 'Opening camera…' : 'Retake'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isPicking }}
              disabled={isPicking}
              onPress={resetCapture}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelButtonText}>Cancel capture</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {permissionIssue ? (
            <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.notice}>
              <Text style={styles.noticeTitle}>Camera access needed</Text>
              <Text style={styles.noticeText}>
                Munmai needs camera access to photograph a transaction document for review.
                Nothing is saved until you submit the transaction.
              </Text>
              <View style={styles.noticeActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void capturePhoto()}
                  style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}>
                  <Text style={styles.noticeButtonText}>Retry</Text>
                </Pressable>
                {permissionIssue.canOpenSettings ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void openSettings()}
                    style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}>
                    <Text style={styles.noticeButtonText}>Open settings</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {pickerError ? (
            <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorNotice}>
              <Text style={styles.errorText}>{pickerError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void capturePhoto()}
                style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}>
                <Text style={styles.noticeButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel={`${scanAction.label}. ${scanAction.description}`}
            accessibilityRole="button"
            accessibilityState={{ busy: isPicking, disabled: isPicking }}
            disabled={isPicking}
            onPress={() => void capturePhoto()}
            style={({ pressed }) => [
              styles.scanAction,
              pressed && styles.scanActionPressed,
              isPicking && styles.disabled,
            ]}>
            <View style={styles.scanIcon}>
              <SymbolView name={actionIcons[scanAction.id]} size={36} tintColor={colors.text} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.scanLabel}>
                {isPicking ? 'Opening camera…' : scanAction.label}
              </Text>
              <Text style={styles.scanDescription}>{scanAction.description}</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityLabel={`${manualAction.label}. ${manualAction.description}`}
            accessibilityRole="button"
            onPress={openManualEntry}
            style={({ pressed }) => [styles.manualAction, pressed && styles.pressed]}>
            <View style={styles.manualIcon}>
              <SymbolView name={actionIcons[manualAction.id]} size={24} tintColor={colors.accent} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.manualLabel}>{manualAction.label}</Text>
              <Text style={styles.manualDescription}>{manualAction.description}</Text>
            </View>
            <Text accessibilityElementsHidden style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  scanAction: {
    minHeight: 176,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderWidth: borders.width,
    borderColor: colors.accent,
    borderRadius: radii.xl,
    backgroundColor: colors.accent,
    padding: spacing.lg,
    ...shadows.raised,
  },
  scanActionPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  scanIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.round,
    backgroundColor: colors.accentSoft,
  },
  actionCopy: { minWidth: 0, flex: 1, gap: spacing.xxs },
  scanLabel: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  scanDescription: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 20,
    textAlign: 'center',
  },
  manualAction: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  manualIcon: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
  },
  manualLabel: { color: colors.text, fontSize: 15, fontWeight: fontWeights.strong },
  manualDescription: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 17 },
  chevron: { color: colors.textMuted, fontSize: 24 },
  notice: {
    gap: spacing.xs,
    borderWidth: borders.width,
    borderColor: colors.accent,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    padding: spacing.md,
  },
  noticeTitle: { color: colors.text, fontSize: 14, fontWeight: fontWeights.strong },
  noticeText: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noticeButton: {
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
  },
  noticeButtonText: { color: colors.text, fontSize: 13, fontWeight: fontWeights.strong },
  errorNotice: {
    gap: spacing.xs,
    borderWidth: borders.width,
    borderColor: colors.expense,
    borderRadius: radii.md,
    backgroundColor: colors.expenseSoft,
    padding: spacing.md,
  },
  errorText: { color: colors.expense, fontSize: typography.caption, lineHeight: 18 },
  reviewCard: {
    gap: spacing.md,
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  preview: {
    width: '100%',
    height: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.background,
  },
  reviewCopy: { gap: spacing.xs },
  reviewTitle: { color: colors.text, fontSize: 19, fontWeight: fontWeights.heavy },
  reviewDescription: { color: colors.textMuted, fontSize: typography.body, lineHeight: 20 },
  typeSelector: { flexDirection: 'row', gap: spacing.xs },
  typeButton: {
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
  expenseSelected: { borderColor: colors.expense, backgroundColor: colors.expense },
  incomeSelected: { borderColor: colors.income, backgroundColor: colors.income },
  typeLabel: { color: colors.textMuted, fontSize: 15, fontWeight: fontWeights.strong },
  selectedTypeLabel: { color: colors.background },
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  secondaryButton: {
    minHeight: touchTargets.minimum,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: fontWeights.strong },
  cancelButton: {
    minHeight: touchTargets.minimum,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  cancelButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: fontWeights.strong },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});

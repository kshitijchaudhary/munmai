import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { getCaptureActions, type CaptureActionId } from '@/capture/capture-actions';
import { ActionTile } from '@/components/action-tile';
import { ScreenContainer } from '@/components/screen-container';
import { ScreenHeader } from '@/components/screen-header';
import { spacing } from '@/constants/theme';
import { PUBLIC_ROUTES } from '@/navigation/routes';

const captureActions = getCaptureActions(PUBLIC_ROUTES);

const actionIcons: Record<CaptureActionId, ComponentProps<typeof SymbolView>['name']> = {
  'scan-receipt': { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  'add-expense': { ios: 'minus.circle.fill', android: 'remove_circle', web: 'remove_circle' },
  'add-income': { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' },
  'split-expense': { ios: 'person.2.fill', android: 'group', web: 'group' },
};

export default function CaptureScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScreenHeader
        eyebrow="Capture"
        subtitle="Choose how you want to record money. You can review everything before saving."
        title="What would you like to add?"
      />
      <View style={styles.actions}>
        {captureActions.map((action) => (
          <ActionTile
            description={action.description}
            icon={actionIcons[action.id]}
            key={action.id}
            label={action.label}
            onPress={() =>
              router.navigate({
                pathname: action.pathname,
                params: { ...action.params, intent: String(Date.now()) },
              } as unknown as Href)
            }
            tone={
              action.id === 'add-income'
                ? 'positive'
                : action.id === 'add-expense' || action.id === 'scan-receipt'
                  ? 'outgoing'
                  : 'accent'
            }
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
});

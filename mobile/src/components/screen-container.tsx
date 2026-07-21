import type { ReactNode } from 'react';
import {
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/constants/theme';

interface ScreenContainerProps {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}

export function ScreenContainer({
  children,
  contentStyle,
  scroll = true,
}: ScreenContainerProps) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    flex: 1,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});

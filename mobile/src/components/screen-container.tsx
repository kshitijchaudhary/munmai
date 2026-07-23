import type { ReactNode } from 'react';
import {
  ScrollView,
  type ScrollViewProps,
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
  refreshControl?: ScrollViewProps['refreshControl'];
  scroll?: boolean;
  showsVerticalScrollIndicator?: boolean;
}

export function ScreenContainer({
  children,
  contentStyle,
  refreshControl,
  scroll = true,
  showsVerticalScrollIndicator = false,
}: ScreenContainerProps) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}>
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
    paddingBottom: layout.pageBottomPadding,
    paddingTop: layout.pageTopPadding,
  },
  content: {
    width: '100%',
    maxWidth: layout.appShellMaxWidth,
    flex: 1,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingHorizontal: layout.pageHorizontalPadding,
  },
});

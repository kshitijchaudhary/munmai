import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/tab-icon';
import { colors } from '@/constants/theme';
import { AUTHENTICATED_TABS } from '@/navigation/routes';

const homeIcon = { ios: 'house.fill', android: 'home', web: 'home' } as const;
const transactionsIcon = {
  ios: 'list.bullet.rectangle',
  android: 'receipt_long',
  web: 'receipt_long',
} as const;
const addIcon = { ios: 'plus', android: 'add', web: 'add' } as const;
const analyticsIcon = {
  ios: 'chart.bar.fill',
  android: 'analytics',
  web: 'analytics',
} as const;
const moreIcon = { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' } as const;

const [homeTab, transactionsTab, addTab, analyticsTab, moreTab] = AUTHENTICATED_TABS;

export default function AuthenticatedTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        height: 64 + bottomInset,
        paddingBottom: bottomInset,
      },
    ],
    [bottomInset],
  );

  return (
    <View style={styles.viewport}>
      <View style={styles.shell}>
        <Tabs
          backBehavior="initialRoute"
          screenOptions={{
            headerShown: false,
            sceneStyle: styles.scene,
            tabBarActiveTintColor: colors.text,
            tabBarHideOnKeyboard: true,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarItemStyle: styles.tabBarItem,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarStyle,
          }}>
          <Tabs.Screen
            name={homeTab.route}
            options={{
              title: homeTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={homeIcon} tintColor={color} />
              ),
            }}
          />
          <Tabs.Screen
            name={transactionsTab.route}
            options={{
              title: transactionsTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={transactionsIcon} tintColor={color} />
              ),
            }}
          />
          <Tabs.Screen
            name={addTab.route}
            options={{
              title: addTab.label,
              tabBarButton: ({
                'aria-label': ariaLabel,
                'aria-selected': ariaSelected,
                children,
                disabled,
                onLongPress,
                onPress,
                role,
                style,
                testID,
              }) => (
                <Pressable
                  aria-label={ariaLabel}
                  aria-selected={ariaSelected}
                  disabled={disabled}
                  onLongPress={onLongPress}
                  onPress={onPress}
                  role={role}
                  style={({ pressed }) => [
                    style,
                    styles.addTabButton,
                    ariaSelected && styles.addTabButtonActive,
                    pressed && styles.addTabButtonPressed,
                    disabled && styles.addTabButtonDisabled,
                  ]}
                  testID={testID}>
                  {children}
                </Pressable>
              ),
              tabBarIcon: ({ color, focused }) => (
                <TabIcon emphasized focused={focused} name={addIcon} tintColor={color} />
              ),
              tabBarIconStyle: styles.addIcon,
            }}
          />
          <Tabs.Screen
            name={analyticsTab.route}
            options={{
              title: analyticsTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={analyticsIcon} tintColor={color} />
              ),
            }}
          />
          <Tabs.Screen
            name={moreTab.route}
            options={{
              title: moreTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={moreIcon} tintColor={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#040A13' : colors.background,
  },
  shell: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    overflow: 'hidden',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  scene: {
    backgroundColor: colors.background,
  },
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 5,
    elevation: 0,
    shadowColor: colors.background,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  tabBarItem: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  addTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  addTabButtonActive: {
    backgroundColor: colors.accentSoft,
  },
  addTabButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  addTabButtonDisabled: {
    opacity: 0.4,
  },
  addIcon: {
    overflow: 'visible',
  },
});

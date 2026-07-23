import { Tabs } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/tab-icon';
import { colors, layout, radii } from '@/constants/theme';
import {
  AUTHENTICATED_TABS,
  getAuthenticatedTabHref,
} from '@/navigation/routes';
import { CAPTURE_TAB_ICON } from '@/navigation/tab-icons';

const todayIcon = { ios: 'house.fill', android: 'home', web: 'home' } as const;
const activityIcon = {
  ios: 'list.bullet.rectangle',
  android: 'receipt_long',
  web: 'receipt_long',
} as const;
const insightsIcon = {
  ios: 'chart.bar.fill',
  android: 'analytics',
  web: 'analytics',
} as const;
const spacesIcon = { ios: 'person.2.fill', android: 'group', web: 'group' } as const;

const [todayTab, activityTab, captureTab, insightsTab, spacesTab] = AUTHENTICATED_TABS;

export default function AuthenticatedTabsLayout() {
  const insets = useSafeAreaInsets();
  const [isCaptureFocused, setIsCaptureFocused] = useState(false);
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        height: layout.tabBarBaseHeight + bottomInset,
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
          screenOptions={({ route }) => ({
            headerShown: false,
            href: getAuthenticatedTabHref(route.name),
            sceneStyle: styles.scene,
            tabBarActiveTintColor: colors.text,
            tabBarHideOnKeyboard: true,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarItemStyle: styles.tabBarItem,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarStyle,
          })}>
          <Tabs.Screen
            name={todayTab.route}
            options={{
              title: todayTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={todayIcon} tintColor={color} />
              ),
            }}
          />
          <Tabs.Screen
            name={activityTab.route}
            options={{
              title: activityTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={activityIcon} tintColor={color} />
              ),
            }}
          />
          <Tabs.Screen
            name={captureTab.route}
            options={{
              title: captureTab.label,
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
                  onBlur={() => setIsCaptureFocused(false)}
                  onFocus={() => setIsCaptureFocused(true)}
                  onLongPress={onLongPress}
                  onPress={onPress}
                  role={role}
                  style={({ pressed }) => [
                    style,
                    styles.captureTabButton,
                    isCaptureFocused && styles.captureTabButtonFocused,
                    ariaSelected && styles.captureTabButtonActive,
                    pressed && styles.captureTabButtonPressed,
                    disabled && styles.captureTabButtonDisabled,
                  ]}
                  testID={testID}>
                  {children}
                </Pressable>
              ),
              tabBarIcon: ({ color, focused }) => (
                <TabIcon
                  emphasized
                  focused={focused}
                  name={CAPTURE_TAB_ICON}
                  tintColor={color}
                />
              ),
              tabBarIconStyle: styles.captureIcon,
            }}
          />
          <Tabs.Screen
            name={insightsTab.route}
            options={{
              title: insightsTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={insightsIcon} tintColor={color} />
              ),
            }}
          />
          <Tabs.Screen
            name={spacesTab.route}
            options={{
              title: spacesTab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon focused={focused} name={spacesIcon} tintColor={color} />
              ),
            }}
          />
          <Tabs.Screen name="more" options={{ href: null }} />
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
    maxWidth: layout.appShellMaxWidth,
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
  captureTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  captureTabButtonActive: {
    backgroundColor: colors.accentSoft,
  },
  captureTabButtonFocused: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  captureTabButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  captureTabButtonDisabled: {
    opacity: 0.4,
  },
  captureIcon: {
    overflow: 'visible',
  },
});

import { SymbolView } from 'expo-symbols';
import { type ComponentProps } from 'react';
import { type ColorValue, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

interface TabIconProps {
  emphasized?: boolean;
  focused: boolean;
  name: ComponentProps<typeof SymbolView>['name'];
  tintColor: ColorValue;
}

export function TabIcon({
  emphasized = false,
  focused,
  name,
  tintColor,
}: TabIconProps) {
  if (emphasized) {
    return (
      <View style={[styles.addButton, focused && styles.addButtonFocused]}>
        <SymbolView name={name} size={27} tintColor={colors.text} />
      </View>
    );
  }

  return (
    <View style={[styles.icon, focused && styles.iconFocused]}>
      <SymbolView name={name} size={23} tintColor={tintColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  iconFocused: {
    backgroundColor: colors.accentSoft,
  },
  addButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background,
    borderRadius: 27,
    backgroundColor: colors.accent,
    transform: [{ translateY: -10 }],
  },
  addButtonFocused: {
    borderColor: colors.text,
  },
});

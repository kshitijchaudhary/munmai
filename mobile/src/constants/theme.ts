export const colors = {
  background: '#08111F',
  surface: '#111D2E',
  surfaceRaised: '#17253A',
  border: '#26364D',
  accent: '#7C5CFC',
  accentSoft: '#25244A',
  text: '#F5F7FB',
  textMuted: '#9AA9BD',
  income: '#4DD4A8',
  incomeSoft: '#12372F',
  expense: '#FF7A73',
  expenseSoft: '#42252A',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  round: 999,
} as const;

export const typography = {
  display: 32,
  screenTitle: 26,
  sectionTitle: 18,
  body: 14,
  caption: 12,
  label: 11,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '600',
  strong: '800',
  heavy: '900',
} as const;

export const borders = {
  width: 1,
  color: colors.border,
} as const;

export const shadows = {
  raised: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
} as const;

export const touchTargets = {
  minimum: 44,
} as const;

export const layout = {
  appShellMaxWidth: 560,
  contentMaxWidth: 520,
  pageHorizontalPadding: 20,
  pageTopPadding: 20,
  pageBottomPadding: 28,
  tabBarBaseHeight: 64,
  tabCount: 5,
  minimumViewportWidth: 375,
} as const;

export function getTabItemWidth(viewportWidth: number): number {
  const constrainedWidth = Math.min(Math.max(viewportWidth, 0), layout.appShellMaxWidth);
  return constrainedWidth / layout.tabCount;
}

export function getFormBottomPadding(safeAreaBottom = 0): number {
  return spacing.lg + Math.max(0, safeAreaBottom);
}

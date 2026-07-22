import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getCaptureActions } from '../src/capture/capture-actions.ts';
import {
  borders,
  colors,
  fontWeights,
  getFormBottomPadding,
  getTabItemWidth,
  layout,
  radii,
  shadows,
  spacing,
  touchTargets,
  typography,
} from '../src/constants/theme.ts';
import { PUBLIC_ROUTES } from '../src/navigation/routes.ts';
import { CAPTURE_TAB_ICON } from '../src/navigation/tab-icons.ts';

const captureActions = getCaptureActions(PUBLIC_ROUTES);

test('Capture actions point only to supported existing workflows', () => {
  assert.deepEqual(
    captureActions.map((action) => action.id),
    ['scan-receipt', 'add-expense', 'add-income'],
  );

  for (const action of captureActions) {
    assert.equal(action.pathname, '/add/transaction');
    assert.equal(action.pathname.includes('(app)'), false);
    assert.equal(action.pathname.includes('/index'), false);
  }

  assert.deepEqual(captureActions[0].params, { capture: 'receipt', type: 'expense' });
  assert.equal(captureActions.some((action) => action.id === 'split-expense'), false);
});

test('design tokens retain a valid compact hierarchy', () => {
  assert.deepEqual(Object.values(spacing), [4, 8, 12, 16, 24, 32]);
  assert.equal(Object.values(colors).every((value) => /^#[0-9A-F]{6}$/i.test(value)), true);
  assert.equal(radii.sm < radii.md && radii.md < radii.lg && radii.lg < radii.xl, true);
  assert.equal(typography.label < typography.body, true);
  assert.equal(typography.body < typography.sectionTitle, true);
  assert.equal(typography.sectionTitle < typography.screenTitle, true);
  assert.equal(Number(fontWeights.regular) < Number(fontWeights.heavy), true);
  assert.equal(borders.width > 0, true);
  assert.equal(shadows.raised.elevation >= 0, true);
  assert.equal(touchTargets.minimum >= 44, true);
});

test('five-tab geometry fits supported widths without horizontal overflow', () => {
  assert.equal(layout.tabCount, 5);
  assert.equal(getTabItemWidth(375), 75);
  assert.equal(getTabItemWidth(375) * layout.tabCount, 375);
  assert.equal(getTabItemWidth(390) * layout.tabCount, 390);
  assert.equal(getTabItemWidth(430) * layout.tabCount, 430);
  assert.equal(getTabItemWidth(1024) * layout.tabCount, layout.appShellMaxWidth);
  assert.equal(getTabItemWidth(375) >= touchTargets.minimum, true);
});

test('nested forms clear the tab bar and bottom safe area', () => {
  assert.equal(getFormBottomPadding(), layout.tabBarBaseHeight + spacing.lg);
  assert.equal(
    getFormBottomPadding(34),
    layout.tabBarBaseHeight + spacing.lg + 34,
  );
  assert.equal(getFormBottomPadding(-10), layout.tabBarBaseHeight + spacing.lg);

  const formSources = [
    '../src/screens/add-transaction-screen.tsx',
    '../src/app/(app)/groups/[groupId]/add-expense.tsx',
    '../src/app/(app)/groups/[groupId]/settlements/new.tsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

  for (const source of formSources) {
    assert.match(source, /getFormBottomPadding\(insets\.bottom\)/);
    assert.match(source, /keyboardShouldPersistTaps="handled"/);
  }
});

test('tab roots are headerless while nested Capture and Space routes retain headers', () => {
  const captureLayout = readFileSync(
    new URL('../src/app/(app)/add/_layout.tsx', import.meta.url),
    'utf8',
  );
  const captureRoute = readFileSync(
    new URL('../src/app/(app)/add/transaction.tsx', import.meta.url),
    'utf8',
  );
  const groupsLayout = readFileSync(
    new URL('../src/app/(app)/groups/_layout.tsx', import.meta.url),
    'utf8',
  );

  assert.match(captureLayout, /name="index" options=\{\{ headerShown: false \}\}/);
  assert.match(captureLayout, /name="transaction" options=\{\{ headerShown: true/);
  assert.match(captureRoute, /capture === 'receipt' \? 'Scan receipt' : 'Add transaction'/);
  assert.match(groupsLayout, /headerShown: true/);
  assert.match(groupsLayout, /name="index" options=\{\{ headerShown: false/);

  for (const nestedRoute of [
    '[groupId]/index',
    '[groupId]/add-expense',
    '[groupId]/settlements/index',
    '[groupId]/settlements/new',
  ]) {
    assert.equal(groupsLayout.includes(`name="${nestedRoute}"`), true);
  }
});

test('Capture uses supported receipt-capture symbols on every platform', () => {
  assert.deepEqual(CAPTURE_TAB_ICON, {
    ios: 'camera.fill',
    android: 'document_scanner',
    web: 'document_scanner',
  });
  assert.equal(Object.values(CAPTURE_TAB_ICON).includes('add'), false);
  assert.equal(Object.values(CAPTURE_TAB_ICON).some((icon) => icon.includes('qr')), false);

  const materialSymbols = JSON.parse(
    readFileSync(
      new URL('../node_modules/expo-symbols/build/android/symbols.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(typeof materialSymbols[CAPTURE_TAB_ICON.android], 'number');
  assert.equal(typeof materialSymbols[CAPTURE_TAB_ICON.web], 'number');
});

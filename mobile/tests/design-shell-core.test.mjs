import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getCaptureActions } from '../src/capture/capture-actions.ts';
import {
  borders,
  colors,
  fontWeights,
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
    ['scan-receipt', 'add-expense', 'add-income', 'split-expense'],
  );

  const supportedPaths = new Set(['/add/transaction', '/groups']);
  for (const action of captureActions) {
    assert.equal(supportedPaths.has(action.pathname), true, `${action.id} has an unsupported target`);
    assert.equal(action.pathname.includes('(app)'), false);
    assert.equal(action.pathname.includes('/index'), false);
  }

  assert.deepEqual(captureActions[0].params, { capture: 'receipt', type: 'expense' });
  assert.deepEqual(captureActions[3].params, { intent: 'split' });
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

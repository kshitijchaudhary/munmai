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

test('Capture hub exposes only scan and manual-entry workflows', () => {
  assert.deepEqual(
    captureActions.map((action) => action.id),
    ['scan-document', 'manual-entry'],
  );

  assert.equal(captureActions[0].pathname, null);
  assert.equal(captureActions[0].primary, true);
  assert.equal(captureActions[1].pathname, '/add/transaction');
  assert.equal(captureActions[1].primary, false);
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

test('focused forms preserve action spacing and the bottom safe area', () => {
  assert.equal(getFormBottomPadding(), spacing.lg);
  assert.equal(getFormBottomPadding(34), spacing.lg + 34);
  assert.equal(getFormBottomPadding(-10), spacing.lg);

  const transactionFormSource = readFileSync(
    new URL('../src/screens/add-transaction-screen.tsx', import.meta.url),
    'utf8',
  );
  const otherFormSources = [
    '../src/app/(app)/groups/[groupId]/add-expense.tsx',
    '../src/app/(app)/groups/[groupId]/settlements/new.tsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

  assert.match(
    transactionFormSource,
    /edges=\{\['top', 'bottom', 'left', 'right'\]\}/,
  );
  assert.match(transactionFormSource, /contentContainerStyle=\{styles\.scrollContent\}/);
  assert.match(transactionFormSource, /bottomSpacer: \{\s*height: getFormBottomPadding\(\)/);
  assert.doesNotMatch(transactionFormSource, /useSafeAreaInsets/);
  assert.equal(
    transactionFormSource.match(/label=\{isIncome \? 'Save income' : 'Save expense'\}/g)
      ?.length,
    1,
  );
  assert.equal(
    transactionFormSource.indexOf(
      "label={isIncome ? 'Save income' : 'Save expense'}",
    ) < transactionFormSource.indexOf('<View style={styles.bottomSpacer} />'),
    true,
  );

  for (const source of otherFormSources) {
    assert.match(source, /getFormBottomPadding\(insets\.bottom\)/);
    assert.match(source, /keyboardShouldPersistTaps="handled"/);
  }

  assert.match(transactionFormSource, /keyboardShouldPersistTaps="handled"/);
});

test('authenticated tab roots share one calm header and page-shell contract', () => {
  const sources = {
    today: readFileSync(new URL('../src/app/(app)/index.tsx', import.meta.url), 'utf8'),
    activity: readFileSync(
      new URL('../src/app/(app)/transactions/index.tsx', import.meta.url),
      'utf8',
    ),
    capture: readFileSync(
      new URL('../src/app/(app)/add/index.tsx', import.meta.url),
      'utf8',
    ),
    insights: readFileSync(
      new URL('../src/app/(app)/analytics.tsx', import.meta.url),
      'utf8',
    ),
    spaces: readFileSync(
      new URL('../src/app/(app)/groups/index.tsx', import.meta.url),
      'utf8',
    ),
  };

  assert.match(sources.today, /<ScreenContainer/);
  assert.match(sources.today, /variant="today"/);
  assert.match(sources.activity, /<ScreenHeader[\s\S]*title="Activity"/);
  assert.match(sources.capture, /<ScreenContainer>/);
  assert.match(sources.capture, /'Capture & go'/);
  assert.match(sources.insights, /<ScreenContainer>/);
  assert.match(sources.insights, /title="Insights"/);
  assert.match(sources.spaces, /<ScreenHeader title="Spaces" \/>/);
  assert.match(sources.spaces, /layout\.pageHorizontalPadding/);

  for (const source of Object.values(sources)) {
    assert.doesNotMatch(source, /styles\.eyebrow/);
  }

  assert.doesNotMatch(sources.activity, /Money in and out|ACTIVITY/);
  assert.doesNotMatch(sources.insights, /Your monthly snapshot|INSIGHTS/);
  assert.doesNotMatch(sources.spaces, /Your Spaces|SPACES/);
});

test('Today has one financial pulse and no legacy dashboard sections', () => {
  const todaySource = readFileSync(
    new URL('../src/app/(app)/index.tsx', import.meta.url),
    'utf8',
  );

  assert.match(todaySource, /title=\{`\$\{greeting\}, \$\{firstName\}`\}/);
  assert.match(todaySource, /subtitle=\{dateContext\}/);
  assert.match(todaySource, /<AvatarButton/);
  assert.equal(todaySource.match(/<TodayPulse/g)?.length, 1);
  assert.doesNotMatch(todaySource, /MonthlySnapshot|Recent activity|RecentTransactionRow/);
  assert.doesNotMatch(todaySource, /Quick capture|Financial snapshot|Quick Actions/);
  assert.match(todaySource, /<TodayContextCard/);
  assert.match(todaySource, /<TodayInsightCard/);
  assert.equal(todaySource.match(/actionLabel="Open Capture"/g)?.length, 1);
  assert.match(todaySource, /PUBLIC_ROUTES\.add/);
});

test('Add Transaction begins with form controls and does not repeat its native title', () => {
  const source = readFileSync(
    new URL('../src/screens/add-transaction-screen.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /Add transaction|NEW TRANSACTION|Add money in or out/);
  assert.match(source, /isCaptureTypeLocked \? \(/);
  assert.match(source, /transactionTypes\.map/);
  assert.match(source, /maxWidth: layout\.appShellMaxWidth/);
  assert.match(source, /paddingHorizontal: layout\.pageHorizontalPadding/);
  assert.match(source, /<View style=\{styles\.bottomSpacer\} \/>/);
});

test('tab roots and compact-link screens hide native headers while other nested forms retain them', () => {
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
  assert.match(captureLayout, /name="transaction" options=\{\{ headerShown: false \}\}/);
  assert.match(captureRoute, /onBack=\{returnToCapture\}/);
  assert.match(groupsLayout, /headerShown: true/);
  assert.match(groupsLayout, /name="index" options=\{\{ headerShown: false/);
  assert.match(
    groupsLayout,
    /name="\[groupId\]\/index" options=\{\{ headerShown: false \}\}/,
  );
  assert.match(groupsLayout, /name="\[groupId\]\/add-expense" options=\{\{ title:/);
  assert.match(
    groupsLayout,
    /name="\[groupId\]\/settlements\/index" options=\{\{ headerShown: false \}\}/,
  );
  assert.match(
    groupsLayout,
    /name="\[groupId\]\/settlements\/new" options=\{\{ headerShown: false \}\}/,
  );
});

test('Capture uses supported receipt-capture symbols on every platform', () => {
  assert.deepEqual(CAPTURE_TAB_ICON, {
    ios: 'camera.fill',
    android: 'photo_camera',
    web: 'photo_camera',
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

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AUTHENTICATED_TABS,
  CAPTURE_HUB_TARGET,
  getAuthExitTransition,
  getAuthenticatedTabHref,
  getHomeAfterTransactionTarget,
  getLegacyRedirectTarget,
  PUBLIC_ROUTES,
} from '../src/navigation/routes.ts';

test('authenticated tabs use the required five-tab order', () => {
  assert.equal(AUTHENTICATED_TABS.length, 5);
  assert.deepEqual(
    AUTHENTICATED_TABS.map((tab) => tab.label),
    ['Today', 'Activity', 'Capture', 'Insights', 'Spaces'],
  );
  assert.deepEqual(
    AUTHENTICATED_TABS.filter((tab) => getAuthenticatedTabHref(tab.route) !== null)
      .map((tab) => tab.route),
    ['index', 'transactions', 'add', 'analytics', 'groups'],
  );
});

test('Capture is the exact center tab', () => {
  assert.equal(AUTHENTICATED_TABS.length, 5);
  assert.deepEqual(AUTHENTICATED_TABS[Math.floor(AUTHENTICATED_TABS.length / 2)], {
    route: 'add',
    label: 'Capture',
    href: '/add',
  });
});

test('Activity and Insights empty states preserve the Capture hub target', () => {
  assert.equal(CAPTURE_HUB_TARGET, '/add');
  assert.notEqual(CAPTURE_HUB_TARGET, PUBLIC_ROUTES.transactionForm);

  const activitySource = readFileSync(
    new URL('../src/app/(app)/transactions/index.tsx', import.meta.url),
    'utf8',
  );
  const insightsSource = readFileSync(
    new URL('../src/app/(app)/analytics.tsx', import.meta.url),
    'utf8',
  );

  assert.match(activitySource, /router\.navigate\(CAPTURE_HUB_TARGET as Href\)/);
  assert.match(insightsSource, /router\.navigate\(CAPTURE_HUB_TARGET as Href\)/);
});

test('Insights preserves the public /analytics route', () => {
  const analyticsTab = AUTHENTICATED_TABS.find((tab) => tab.route === 'analytics');

  assert.equal(PUBLIC_ROUTES.analytics, '/analytics');
  assert.equal(analyticsTab?.href, '/analytics');
});

test('Spaces maps directly to the existing authenticated groups functionality', () => {
  const spacesTab = AUTHENTICATED_TABS.find((tab) => tab.label === 'Spaces');

  assert.equal(PUBLIC_ROUTES.groups, '/groups');
  assert.deepEqual(spacesTab, {
    route: 'groups',
    label: 'Spaces',
    href: '/groups',
  });
});

test('account remains accessible without occupying a visible tab', () => {
  assert.equal(PUBLIC_ROUTES.account, '/more');
  assert.equal(AUTHENTICATED_TABS.some((tab) => tab.href === PUBLIC_ROUTES.account), false);
  assert.equal(getAuthenticatedTabHref('more'), null);
});

test('nested Capture routes stay navigable without becoming tab items', () => {
  assert.equal(PUBLIC_ROUTES.transactionForm, '/add/transaction');
  assert.equal(
    AUTHENTICATED_TABS.some((tab) => tab.href === PUBLIC_ROUTES.transactionForm),
    false,
  );
  assert.equal(getAuthenticatedTabHref('add/transaction'), null);
  assert.equal(getAuthenticatedTabHref('add/future-screen'), null);
  assert.equal(getAuthenticatedTabHref('add'), '/add');
});

test('logout replaces the active route and Back cannot reopen legacy /dashboard', () => {
  assert.deepEqual(getAuthExitTransition('authenticated', 'unauthenticated'), {
    method: 'replace',
    target: '/sign-in',
  });
  assert.equal(getLegacyRedirectTarget('dashboard', false), '/sign-in');
});

test('session expiration replaces the active route and Back cannot reopen legacy /dashboard', () => {
  assert.deepEqual(getAuthExitTransition('authenticated', 'unauthenticated'), {
    method: 'replace',
    target: '/sign-in',
  });
  assert.equal(getLegacyRedirectTarget('dashboard', false), '/sign-in');
});

test('direct /dashboard navigation redirects safely for either auth state', () => {
  assert.equal(getLegacyRedirectTarget('dashboard', true), '/');
  assert.equal(getLegacyRedirectTarget('dashboard', false), '/sign-in');
});

test('direct /add-transaction navigation redirects safely for either auth state', () => {
  assert.equal(getLegacyRedirectTarget('add-transaction', true), '/add/transaction');
  assert.equal(getLegacyRedirectTarget('add-transaction', false), '/sign-in');
});

test('income creation targets the public Home route with its success parameter', () => {
  assert.deepEqual(getHomeAfterTransactionTarget('income'), {
    pathname: '/',
    params: { created: 'income' },
  });
});

test('expense creation targets the public Home route with its success parameter', () => {
  assert.deepEqual(getHomeAfterTransactionTarget('expense'), {
    pathname: '/',
    params: { created: 'expense' },
  });
});

test('public navigation targets never expose a route group or index segment', () => {
  const paths = [
    ...Object.values(PUBLIC_ROUTES),
    ...AUTHENTICATED_TABS.map((tab) => tab.href),
    getHomeAfterTransactionTarget('income').pathname,
    getHomeAfterTransactionTarget('expense').pathname,
  ];

  for (const path of paths) {
    assert.equal(path.includes('(app)'), false, `${path} exposes the authenticated route group`);
    assert.equal(/(^|\/)index(?:\/|$)/.test(path), false, `${path} exposes an index segment`);
  }
});

test('application navigation constants contain no deleted public routes', () => {
  const deletedPaths = new Set(['/dashboard', '/add-transaction']);

  for (const path of Object.values(PUBLIC_ROUTES)) {
    assert.equal(deletedPaths.has(path), false, `${path} is a deleted public route`);
  }
});

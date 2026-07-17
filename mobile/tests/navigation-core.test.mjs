import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTHENTICATED_TABS,
  getAuthExitTransition,
  getHomeAfterTransactionTarget,
  getLegacyRedirectTarget,
  PUBLIC_ROUTES,
} from '../src/navigation/routes.ts';

test('authenticated tabs use the required five-tab order', () => {
  assert.deepEqual(
    AUTHENTICATED_TABS.map((tab) => tab.label),
    ['Home', 'Transactions', 'Add', 'Analytics', 'More'],
  );
});

test('Add is the exact center tab', () => {
  assert.equal(AUTHENTICATED_TABS.length, 5);
  assert.equal(AUTHENTICATED_TABS[Math.floor(AUTHENTICATED_TABS.length / 2)].route, 'add');
});

test('Analytics uses the public /analytics route', () => {
  const analyticsTab = AUTHENTICATED_TABS.find((tab) => tab.route === 'analytics');

  assert.equal(PUBLIC_ROUTES.analytics, '/analytics');
  assert.equal(analyticsTab?.href, '/analytics');
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
  assert.equal(getLegacyRedirectTarget('add-transaction', true), '/add');
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

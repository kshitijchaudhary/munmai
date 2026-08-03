import type { AuthStatus } from '@/auth/types';
import type { TransactionType } from '@/transactions/transaction-form';

export type LegacyRouteName = 'dashboard' | 'add-transaction';

export const PUBLIC_ROUTES = {
  home: '/',
  transactions: '/transactions',
  add: '/add',
  transactionForm: '/add/transaction',
  analytics: '/analytics',
  account: '/more',
  groups: '/groups',
  signIn: '/sign-in',
  forgotPassword: '/forgot-password',
  register: '/register',
} as const;

export const CAPTURE_HUB_TARGET = PUBLIC_ROUTES.add;

export const AUTHENTICATED_TABS = [
  { route: 'index', label: 'Dashboard', href: PUBLIC_ROUTES.home },
  { route: 'transactions', label: 'Activity', href: PUBLIC_ROUTES.transactions },
  { route: 'add', label: 'Capture', href: PUBLIC_ROUTES.add },
  { route: 'analytics', label: 'Insights', href: PUBLIC_ROUTES.analytics },
  { route: 'groups', label: 'Spaces', href: PUBLIC_ROUTES.groups },
] as const;

export type AuthenticatedTabHref = (typeof AUTHENTICATED_TABS)[number]['href'];

export function getAuthenticatedTabHref(
  routeName: string,
): AuthenticatedTabHref | null {
  return AUTHENTICATED_TABS.find((tab) => tab.route === routeName)?.href ?? null;
}

export function shouldHideAuthenticatedTabBar(pathname: string): boolean {
  const normalizedPath = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';

  return (
    normalizedPath === PUBLIC_ROUTES.transactionForm ||
    /^\/groups\/[^/]+\/(?:add-expense|settlements\/new)$/.test(normalizedPath)
  );
}

export function getHomeAfterTransactionTarget(type: TransactionType) {
  return {
    pathname: PUBLIC_ROUTES.home,
    params: { created: type },
  } as const;
}

export function getAuthExitTransition(
  previousStatus: AuthStatus,
  currentStatus: AuthStatus,
) {
  if (previousStatus !== 'authenticated' || currentStatus !== 'unauthenticated') {
    return null;
  }

  return {
    method: 'replace',
    target: PUBLIC_ROUTES.signIn,
  } as const;
}

export function getLegacyRedirectTarget(
  route: LegacyRouteName,
  isAuthenticated: boolean,
) {
  if (!isAuthenticated) {
    return PUBLIC_ROUTES.signIn;
  }

  return route === 'dashboard' ? PUBLIC_ROUTES.home : PUBLIC_ROUTES.transactionForm;
}

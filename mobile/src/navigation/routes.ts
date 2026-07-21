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
  register: '/register',
} as const;

export const AUTHENTICATED_TABS = [
  { route: 'index', label: 'Today', href: PUBLIC_ROUTES.home },
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

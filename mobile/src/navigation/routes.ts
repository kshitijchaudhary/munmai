import type { AuthStatus } from '@/auth/types';
import type { TransactionType } from '@/transactions/transaction-form';

export type LegacyRouteName = 'dashboard' | 'add-transaction';

export const PUBLIC_ROUTES = {
  home: '/',
  transactions: '/transactions',
  add: '/add',
  analytics: '/analytics',
  more: '/more',
  signIn: '/sign-in',
  register: '/register',
} as const;

export const AUTHENTICATED_TABS = [
  { route: 'index', label: 'Home', href: PUBLIC_ROUTES.home },
  { route: 'transactions', label: 'Transactions', href: PUBLIC_ROUTES.transactions },
  { route: 'add', label: 'Add', href: PUBLIC_ROUTES.add },
  { route: 'analytics', label: 'Analytics', href: PUBLIC_ROUTES.analytics },
  { route: 'more', label: 'More', href: PUBLIC_ROUTES.more },
] as const;

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

  return route === 'dashboard' ? PUBLIC_ROUTES.home : PUBLIC_ROUTES.add;
}

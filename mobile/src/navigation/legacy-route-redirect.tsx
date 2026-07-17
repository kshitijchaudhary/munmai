import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/auth/auth-context';
import {
  getLegacyRedirectTarget,
  type LegacyRouteName,
} from '@/navigation/routes';

interface LegacyRouteRedirectProps {
  route: LegacyRouteName;
}

export function LegacyRouteRedirect({ route }: LegacyRouteRedirectProps) {
  const router = useRouter();
  const { status } = useAuth();
  const target = getLegacyRedirectTarget(route, status === 'authenticated');

  useFocusEffect(
    useCallback(() => {
      router.replace(target as unknown as Href);
    }, [router, target]),
  );

  return null;
}

import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { GroupDetailScreen } from '@/groups/group-detail-screen';
import { parseGroupRoute } from '@/groups/group-routes';
import { PUBLIC_ROUTES } from '@/navigation/routes';

export default function ActivityGroupDetailRoute() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = parseGroupRoute(params.groupId);
  const router = useRouter();
  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(PUBLIC_ROUTES.transactions as Href);
  }, [router]);

  return (
    <GroupDetailScreen
      groupId={groupId}
      initialSection="activity"
      onBack={goBack}
    />
  );
}

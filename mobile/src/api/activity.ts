import { apiClient } from '@/api/client';

export async function getActivityFeed(signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get('/activity', { signal })).data;
}

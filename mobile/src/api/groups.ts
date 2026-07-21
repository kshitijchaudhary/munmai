import { apiClient } from '@/api/client';
import type { CreateSharedExpensePayload } from '@/groups/shared-expense-form';

export async function getGroups(signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get('/groups', { signal })).data;
}

export async function getGroupSummary(groupId: string, signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get(`/groups/${encodeURIComponent(groupId)}/summary`, { signal })).data;
}

export async function getGroupMemberships(groupId: string, signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get(`/groups/${encodeURIComponent(groupId)}/memberships`, { signal })).data;
}

export async function getGroupActivity(groupId: string, signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get(`/groups/${encodeURIComponent(groupId)}/expenses`, { signal })).data;
}

export async function createSharedExpense(payload: CreateSharedExpensePayload, signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.post('/shared-expenses', payload, { signal })).data;
}

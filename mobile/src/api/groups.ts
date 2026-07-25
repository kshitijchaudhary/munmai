import { apiClient } from '@/api/client';
import type { CreateSharedExpensePayload } from '@/groups/shared-expense-form';
import type { CreateSettlementPayload } from '@/groups/settlement-model';

export async function getGroups(signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get('/groups', { signal })).data;
}

export async function getGroup(groupId: string, signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get(`/groups/${encodeURIComponent(groupId)}`, { signal })).data;
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

export async function createSharedExpense(
  payload: CreateSharedExpensePayload,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return (
    await apiClient.post('/shared-expenses', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
    })
  ).data;
}

export async function getSettlementHistory(groupId: string, signal?: AbortSignal): Promise<unknown> {
  return (await apiClient.get(`/groups/${encodeURIComponent(groupId)}/settlements`, { signal })).data;
}

export async function createSettlement(
  groupId: string,
  payload: CreateSettlementPayload,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return (
    await apiClient.post(`/groups/${encodeURIComponent(groupId)}/settlements`, payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
    })
  ).data;
}

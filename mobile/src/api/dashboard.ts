import { apiClient } from '@/api/client';
import {
  parseDashboardData,
  type DashboardData,
} from '@/dashboard/dashboard-model';

export async function getDashboardData(signal?: AbortSignal): Promise<DashboardData> {
  const [incomeResponse, expenseResponse] = await Promise.all([
    apiClient.get<unknown>('/income', { signal }),
    apiClient.get<unknown>('/expenses', { signal }),
  ]);

  return parseDashboardData(incomeResponse.data, expenseResponse.data);
}

export type { DashboardData } from '@/dashboard/dashboard-model';

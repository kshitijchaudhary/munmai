import type { Planning, PlanningApi, PlanningResponse, SafeToSpendResult } from './planning-model';

interface PlanningHttpClient {
  get<T>(url: string, config?: { signal?: AbortSignal }): Promise<{ data: T }>;
  put<T>(url: string, payload: Planning): Promise<{ data: T }>;
}

export function createPlanningApi(client: PlanningHttpClient): PlanningApi {
  return {
    async getPlanning(signal) {
      const response = await client.get<PlanningResponse>('/planning', { signal });
      return response.data;
    },
    async getSafeToSpend(signal) {
      const response = await client.get<SafeToSpendResult>('/planning/safe-to-spend', { signal });
      return response.data;
    },
    async updatePlanning(payload) {
      const response = await client.put<PlanningResponse>('/planning', payload);
      return response.data;
    },
  };
}

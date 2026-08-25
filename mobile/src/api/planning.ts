import { apiClient } from '@/api/client';
import { createPlanningApi } from '@/planning/planning-api-adapter';

export const planningApi = createPlanningApi(apiClient);

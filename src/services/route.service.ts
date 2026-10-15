import { apiClient } from '@/src/lib/apiClient'
import type { DayPlanRouteResponse } from '@/types/backend-api'

export const RouteService = {
  calculateRoute(
    destinationIds: number[],
    bufferTimeSeconds?: number,
  ): Promise<DayPlanRouteResponse> {
    return apiClient.request<DayPlanRouteResponse>('/api/route/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationIds,
        ...(bufferTimeSeconds !== undefined && { bufferTimeSeconds }),
      }),
    })
  },
}

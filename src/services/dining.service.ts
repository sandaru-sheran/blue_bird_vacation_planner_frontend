import { apiClient } from '@/src/lib/apiClient'
import type { DiningInsight } from '@/types/backend-api'

const jsonHeaders = { 'Content-Type': 'application/json' }

export const DiningService = {
  getNearby(destinationId: number): Promise<DiningInsight[]> {
    return apiClient.request<DiningInsight[]>(`/api/dining/nearby/${destinationId}`)
  },

  create(data: Omit<DiningInsight, 'id'>): Promise<DiningInsight> {
    return apiClient.request<DiningInsight>('/api/dining', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    })
  },

  update(id: number, data: Omit<DiningInsight, 'id'>): Promise<DiningInsight> {
    return apiClient.request<DiningInsight>(`/api/dining/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    })
  },

  delete(id: number): Promise<void> {
    return apiClient.request<void>(`/api/dining/${id}`, {
      method: 'DELETE',
    })
  },
}

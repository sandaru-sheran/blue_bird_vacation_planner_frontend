import { apiClient } from '@/src/lib/apiClient'
import type { Destination, DestinationRequest } from '@/types/backend-api'

const jsonHeaders = { 'Content-Type': 'application/json' }

export const DestinationService = {
  getAll(category?: string): Promise<Destination[]> {
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    return apiClient.request<Destination[]>(`/api/destinations${query}`)
  },

  getById(id: number): Promise<Destination> {
    return apiClient.request<Destination>(`/api/destinations/${id}`)
  },

  create(data: DestinationRequest): Promise<Destination> {
    return apiClient.request<Destination>('/api/destinations', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    })
  },

  update(id: number, data: DestinationRequest): Promise<Destination> {
    return apiClient.request<Destination>(`/api/destinations/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    })
  },

  delete(id: number): Promise<void> {
    return apiClient.request<void>(`/api/destinations/${id}`, {
      method: 'DELETE',
    })
  },
}

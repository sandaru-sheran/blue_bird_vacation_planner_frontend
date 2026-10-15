import { apiClient } from '@/src/lib/apiClient'

interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  type: string
  username: string
}

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : 'Invalid credentials'
      throw new Error(message)
    }

    return data as LoginResponse
  },

  async logout(): Promise<void> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error('Unable to log out')
    }
  },

  updatePassword(data: { currentPassword?: string; newPassword: string }): Promise<{ message?: string }> {
    return apiClient.request<{ message?: string }>('/api/auth/update-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
}

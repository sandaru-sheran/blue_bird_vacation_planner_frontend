export class ApiClientError extends Error {
  readonly status: number
  readonly response: Response

  constructor(message: string, response: Response) {
    super(message)
    this.name = 'ApiClientError'
    this.status = response.status
    this.response = response
  }
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.location.assign('/')
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`

  try {
    const body: unknown = await response.clone().json()
    if (body && typeof body === 'object') {
      if ('message' in body && typeof body.message === 'string') {
        return body.message
      }
      if ('error' in body && typeof body.error === 'string') {
        return body.error
      }
    }
  } catch {
    // The response may not contain JSON.
  }

  return fallback
}

class ApiClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private applyRequestInterceptor(options: RequestInit): RequestInit {
    const headers = new Headers(options.headers)
    return { ...options, credentials: 'include', headers }
  }

  private async applyResponseInterceptor(response: Response): Promise<Response> {
    if (response.status === 401) {
      redirectToLogin()
    }

    if (!response.ok) {
      throw new ApiClientError(await getErrorMessage(response), response)
    }

    return response
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const requestOptions = this.applyRequestInterceptor(options)
    const proxyPath = path.startsWith('/api/') ? `/api/proxy${path.slice(4)}` : path
    const response = await fetch(proxyPath, requestOptions)
    const successfulResponse = await this.applyResponseInterceptor(response)

    if (successfulResponse.status === 204) {
      return undefined as T
    }

    return successfulResponse.json() as Promise<T>
  }
}

export const apiClient = new ApiClient('')

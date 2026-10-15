const backendUrl = process.env.BACKEND_API_BASE_URL

export function getBackendUrl(): string {
  if (!backendUrl) {
    throw new Error('BACKEND_API_BASE_URL must be configured')
  }

  const parsedUrl = new URL(backendUrl)
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('BACKEND_API_BASE_URL must use HTTPS in production')
  }

  return parsedUrl.toString().replace(/\/$/, '')
}

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getBackendUrl } from '@/src/lib/backend-url'

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function proxyRequest(request: Request, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params
  const requestUrl = new URL(request.url)
  const token = (await cookies()).get('adminToken')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('cookie')
  headers.set('Authorization', `Bearer ${token}`)

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer()
  const backendResponse = await fetch(`${getBackendUrl()}/api/${path.join('/')}${requestUrl.search}`, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  const contentType = backendResponse.headers.get('content-type')
  if (contentType) responseHeaders.set('content-type', contentType)
  const cacheControl = backendResponse.headers.get('cache-control')
  if (cacheControl) responseHeaders.set('cache-control', cacheControl)

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const DELETE = proxyRequest

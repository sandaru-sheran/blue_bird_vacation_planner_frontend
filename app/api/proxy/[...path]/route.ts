import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

type RouteContext = {
  params: Promise<{ path: string[] }>
}

const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080'

async function proxyRequest(request: Request, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params
  const requestUrl = new URL(request.url)
  const token = (await cookies()).get('adminToken')?.value
  const headers = new Headers(request.headers)

  headers.delete('host')
  headers.delete('content-length')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer()
  const backendResponse = await fetch(`${backendUrl}/api/${path.join('/')}${requestUrl.search}`, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  })

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: backendResponse.headers,
  })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const DELETE = proxyRequest

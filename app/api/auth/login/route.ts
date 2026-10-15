import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getBackendUrl } from '@/src/lib/backend-url'

interface LoginResponse {
  token: string
  type: string
  username: string
}

export async function POST(request: Request): Promise<NextResponse> {
  const credentials = await request.json()
  const backendResponse = await fetch(`${getBackendUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    cache: 'no-store',
  })

  const responseBody: unknown = await backendResponse.json().catch(() => null)
  if (!backendResponse.ok) {
    return NextResponse.json(responseBody ?? { message: 'Invalid credentials' }, {
      status: backendResponse.status,
    })
  }

  if (
    !responseBody ||
    typeof responseBody !== 'object' ||
    !('token' in responseBody) ||
    typeof responseBody.token !== 'string' ||
    !('type' in responseBody) ||
    typeof responseBody.type !== 'string' ||
    !('username' in responseBody) ||
    typeof responseBody.username !== 'string'
  ) {
    return NextResponse.json({ message: 'Invalid login response' }, { status: 502 })
  }

  const loginResponse = responseBody as LoginResponse
  const cookieStore = await cookies()
  cookieStore.set('adminToken', loginResponse.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  })

  return NextResponse.json({
    type: loginResponse.type,
    username: loginResponse.username,
  })
}

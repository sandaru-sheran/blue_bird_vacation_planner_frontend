import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies()
  cookieStore.delete('adminToken')

  return new NextResponse(null, { status: 204 })
}

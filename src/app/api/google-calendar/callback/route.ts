import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const userId  = searchParams.get('state')
  const error   = searchParams.get('error')

  if (error || !code || !userId) {
    return NextResponse.redirect(new URL('/admin/settings?google=error', req.url))
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI!

  // Token exchange
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  })
  const tokens = await tokenRes.json()
  if (!tokens.access_token) return NextResponse.redirect(new URL('/admin/settings?google=error', req.url))

  // Get user email
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json()

  await prisma.googleCalendarConnection.upsert({
    where: { userId },
    create: {
      userId,
      googleAccountEmail: profile.email,
      accessTokenEncrypted: tokens.access_token,
      refreshTokenEncrypted: tokens.refresh_token ?? '',
      calendarId: 'primary',
      syncEnabled: true,
      syncStatus: 'ACTIVE',
    },
    update: {
      googleAccountEmail: profile.email,
      accessTokenEncrypted: tokens.access_token,
      refreshTokenEncrypted: tokens.refresh_token ?? '',
      syncStatus: 'ACTIVE',
      syncEnabled: true,
    },
  })

  return NextResponse.redirect(new URL('/admin/settings?google=connected', req.url))
}

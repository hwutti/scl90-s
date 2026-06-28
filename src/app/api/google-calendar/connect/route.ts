import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({
      error: 'Google Calendar nicht konfiguriert. Bitte GOOGLE_CLIENT_ID und GOOGLE_REDIRECT_URI in der .env setzen.',
    }, { status: 501 })
  }

  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar')
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${(session.user as any).id}`

  return NextResponse.redirect(url)
}

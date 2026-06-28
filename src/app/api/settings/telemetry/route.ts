import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const consent = await prisma.usageTelemetryConsent.findUnique({ where: { userId } })
  return NextResponse.json({ enabled: consent?.enabled ?? false })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { enabled } = await req.json()
  const consent = await prisma.usageTelemetryConsent.upsert({
    where: { userId },
    create: { userId, enabled, consentedAt: enabled ? new Date() : null },
    update: {
      enabled,
      consentedAt: enabled ? new Date() : undefined,
      revokedAt:  !enabled ? new Date() : undefined,
    },
  })
  return NextResponse.json({ enabled: consent.enabled })
}

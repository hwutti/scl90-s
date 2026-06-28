import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateSessionPrice, recalcSessionBillingStatus } from '@/lib/services/session.service'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')

  const where: any = role === 'ADMIN' ? {} : { therapistId: userId }
  if (patientId) where.patientId = patientId

  const sessions = await prisma.therapySession.findMany({
    where,
    orderBy: { sessionDate: 'desc' },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      protocols: { select: { id: true, type: true } },
      _count: { select: { txAllocations: true } },
    },
  })
  return NextResponse.json(sessions)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const body = await req.json()

  try {
  const count = await prisma.therapySession.count({ where: { patientId: body.patientId } })
  const sessionNumber = count + 1

  const calculatedPrice = calculateSessionPrice({
    billingMode: body.billingMode ?? 'time',
    durationMinutes: body.durationMinutes,
    unitCount: body.unitCount,
    unitPriceNet: body.unitPriceNet,
    hourlyRateNet: body.hourlyRateNet,
  })

  const ts = await prisma.therapySession.create({
    data: {
      patientId: body.patientId,
      therapistId: userId,
      sessionDate: new Date(body.sessionDate),
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      durationMinutes: body.durationMinutes ? parseInt(body.durationMinutes) : undefined,
      name: body.name || `Session-${String(sessionNumber).padStart(3,'0')} · ${new Date(body.sessionDate).toLocaleDateString('de-AT')}`,
      sessionNumber,
      billingMode: body.billingMode ?? 'time',
      unitCount: body.unitCount ? parseFloat(body.unitCount) : undefined,
      unitPriceNet: body.unitPriceNet ? parseFloat(body.unitPriceNet) : undefined,
      hourlyRateNet: body.hourlyRateNet ? parseFloat(body.hourlyRateNet) : undefined,
      calculatedPriceNet: calculatedPrice ?? undefined,
      serviceLabel: body.serviceLabel || undefined,
      billingStatus: 'UNBILLED',
    },
  })

  await prisma.profileTimelineEvent.create({
    data: {
      patientId: body.patientId,
      eventType: 'session_created',
      relatedEntityType: 'therapy_session',
      relatedEntityId: ts.id,
      title: `Session #${sessionNumber} erstellt`,
      eventDate: new Date(),
      createdByUserId: userId,
    },
  })

  return NextResponse.json(ts)
  } catch (e: any) {
    console.error('[therapy-sessions POST]', e?.message)
    return NextResponse.json({ error: e?.message ?? 'Interner Fehler' }, { status: 500 })
  }
}

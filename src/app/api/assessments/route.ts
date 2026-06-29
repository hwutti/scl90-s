import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, instrumentId, occasion, normTableId } = await req.json()
  if (!patientId)    return NextResponse.json({ error: 'patientId fehlt' },    { status: 400 })
  if (!instrumentId) return NextResponse.json({ error: 'instrumentId fehlt' }, { status: 400 })

  const assessment = await prisma.assessment.create({
    data: {
      patientId,
      instrumentId,
      createdByUserId: userId,
      occasion: occasion || null,
      normTableId: normTableId || null,
      status: 'ASSIGNED',
    },
    include: { instrument: true },
  })

  await prisma.auditLog.create({
    data: {
      userId,
      patientId,
      assessmentId: assessment.id,
      action: 'ASSESSMENT_CREATED',
      details: { instrument: assessment.instrument.code, occasion },
    },
  }).catch(() => {})

  return NextResponse.json(assessment)
}

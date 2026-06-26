import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const sessions = await prisma.assessmentSession.findMany({
    where: role === 'PATIENT' ? { userId } : role === 'THERAPIST' ? { user: { therapistId: userId } } : {},
    include: { result: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(sessions)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role === 'PATIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const userId = (session.user as any).id

  const assessment = await prisma.assessmentSession.create({
    data: {
      userId,
      patientName:   body.patientName ?? null,
      patientGender: body.patientGender ?? null,
      patientDob:    body.patientDob ?? null,
      occasion:      body.occasion ?? null,
    },
  })

  await prisma.auditLog.create({
    data: { userId, sessionId: assessment.id, action: 'SESSION_CREATED' },
  }).catch(() => {})

  return NextResponse.json(assessment)
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (role !== 'PATIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const patient = await prisma.patient.findUnique({ where: { patientUserId: userId } })
  if (!patient) return NextResponse.json({ patient: null, assessments: [] })

  const assessments = await prisma.assessment.findMany({
    where: { patientId: patient.id },
    include: { result: true, instrument: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ patient, assessments })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const diags = await prisma.patientDiagnosis.findMany({
    where: { patientId: params.id },
    orderBy: [{ diagnosisType: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(diags)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const body = await req.json()

  const diag = await prisma.patientDiagnosis.create({
    data: {
      ...body,
      patientId: params.id,
      createdBy: userId,
    },
  })

  // Timeline-Event
  try {
    await prisma.profileTimelineEvent.create({
      data: {
        patientId: params.id,
        eventType: 'diagnosis_added',
        relatedEntityType: 'diagnosis',
        relatedEntityId: diag.id,
        title: `Diagnose: ${diag.icdCode} – ${diag.icdLabel}`,
        summary: diag.certainty ? `Sicherheit: ${diag.certainty}` : undefined,
        eventDate: new Date(),
        createdByUserId: userId,
      },
    })
  } catch (_) {}

  // AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        patientId: params.id,
        action: 'DIAGNOSIS_CREATED' as any,
        details: { diagId: diag.id, icdCode: diag.icdCode },
      },
    })
  } catch (_) {}

  return NextResponse.json(diag)
}

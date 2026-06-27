import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  itemNumber: z.number().int().min(1).max(90),
  value: z.number().int().min(0).max(4),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { patient: true },
  })
  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Zugriffsprüfung: Patient (eigener) oder Therapeut
  const role = (session.user as any).role
  if (role === 'PATIENT' && assessment.patient.patientUserId !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  const { itemNumber, value } = parsed.data

  await prisma.answer.upsert({
    where: { assessmentId_itemNumber: { assessmentId: params.id, itemNumber } },
    create: { assessmentId: params.id, itemNumber, value, answeredAt: new Date() },
    update: { value, answeredAt: new Date() },
  })

  // Status auf IN_PROGRESS setzen
  if (assessment.status === 'ASSIGNED') {
    await prisma.assessment.update({
      where: { id: params.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: { userId, patientId: assessment.patientId, assessmentId: params.id, action: 'ASSESSMENT_STARTED' },
    }).catch(() => {})
  } else {
    await prisma.assessment.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true })
}

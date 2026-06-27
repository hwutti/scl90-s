import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { chiefComplaint, medicalHistory, medication, allergies,
          familyHistory, socialHistory, diagnoses, therapyGoals,
          therapyStart, therapyEnd, sessionFrequency, notes } = body

  const record = await prisma.patientRecord.upsert({
    where: { patientId: params.id },
    create: {
      patientId: params.id,
      updatedByUserId: userId,
      ...(chiefComplaint && { chiefComplaint }),
      ...(medicalHistory && { medicalHistory }),
      ...(medication     && { medication }),
      ...(allergies      && { allergies }),
      ...(familyHistory  && { familyHistory }),
      ...(socialHistory  && { socialHistory }),
      ...(diagnoses      !== undefined && { diagnoses }),
      ...(therapyGoals   && { therapyGoals }),
      ...(therapyStart   && { therapyStart: new Date(therapyStart) }),
      ...(therapyEnd     && { therapyEnd: new Date(therapyEnd) }),
      ...(sessionFrequency && { sessionFrequency }),
      ...(notes          !== undefined && { notes }),
    },
    update: {
      updatedByUserId: userId,
      ...(chiefComplaint !== undefined && { chiefComplaint }),
      ...(medicalHistory !== undefined && { medicalHistory }),
      ...(medication     !== undefined && { medication }),
      ...(allergies      !== undefined && { allergies }),
      ...(familyHistory  !== undefined && { familyHistory }),
      ...(socialHistory  !== undefined && { socialHistory }),
      ...(diagnoses      !== undefined && { diagnoses }),
      ...(therapyGoals   !== undefined && { therapyGoals }),
      ...(therapyStart   !== undefined && { therapyStart: therapyStart ? new Date(therapyStart) : null }),
      ...(therapyEnd     !== undefined && { therapyEnd: therapyEnd ? new Date(therapyEnd) : null }),
      ...(sessionFrequency !== undefined && { sessionFrequency }),
      ...(notes          !== undefined && { notes }),
      version: { increment: 1 },
    },
  })

  await prisma.auditLog.create({
    data: { userId, patientId: params.id, action: 'RECORD_UPDATED' },
  }).catch(() => {})

  return NextResponse.json(record)
}

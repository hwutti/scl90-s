import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const therapistId = searchParams.get('therapistId') || userId

  const entries = await prisma.waitlistEntry.findMany({
    where: { therapistId, status: 'WAITING' },
    include: { patient: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const { patientId, therapistId, typeId, preferredDays, preferredTime, note } = await req.json()

  let resolvedPatientId = patientId
  if (role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { patientUserId: userId } })
    if (!patient) return NextResponse.json({ error: 'Kein Patient gefunden' }, { status: 404 })
    resolvedPatientId = patient.id
  }

  const entry = await prisma.waitlistEntry.create({
    data: {
      patientId: resolvedPatientId,
      therapistId: therapistId || userId,
      typeId: typeId || null,
      preferredDays: preferredDays ?? [],
      preferredTime: preferredTime || null,
      note: note || null,
    },
  })
  return NextResponse.json(entry)
}

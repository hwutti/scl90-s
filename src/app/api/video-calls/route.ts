import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function generateCallCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase()
}

function generateJitsiRoomName() {
  // Anonym — kein Patientenname!
  return 'kds-' + crypto.randomBytes(8).toString('hex')
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const calls = await prisma.videoCall.findMany({
    where: { createdByUserId: userId, status: { notIn: ['ENDED', 'EXPIRED', 'CANCELLED'] } },
    orderBy: { createdAt: 'desc' },
    include: { patient: { select: { firstName: true, lastName: true } } },
  })
  return NextResponse.json(calls)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const userId = (session.user as any).id

  const jitsiRoomName = generateJitsiRoomName()
  // Jitsi: entweder eigene Instanz oder meet.jit.si
  const jitsiBase = process.env.JITSI_BASE_URL ?? 'https://meet.jit.si'
  const accessLink = `${jitsiBase}/${jitsiRoomName}`

  const call = await prisma.videoCall.create({
    data: {
      patientId: body.patientId,
      appointmentId: body.appointmentId,
      sessionId: body.sessionId,
      createdByUserId: userId,
      callCode: generateCallCode(),
      accessLink,
      jitsiRoomName,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 24 * 3600000),
      status: 'PLANNED',
    },
  })
  return NextResponse.json(call)
}

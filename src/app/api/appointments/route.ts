import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyAppointment, expandRecurrence } from '@/lib/calendar'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  const therapistId = searchParams.get('therapistId')

  let where: any = {}
  if (from) where.startAt = { ...where.startAt, gte: new Date(from) }
  if (to)   where.startAt = { ...where.startAt, lte: new Date(to) }

  if (role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { patientUserId: userId } })
    if (!patient) return NextResponse.json([])
    where.patientId = patient.id
    where.status = { notIn: ['CANCELLED'] }
  } else if (role === 'THERAPIST') {
    where.therapistId = therapistId || userId
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      therapist: { select: { id: true, name: true } },
      type: true,
    },
    orderBy: { startAt: 'asc' },
  })

  return NextResponse.json(appointments)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const body = await req.json()
  const {
    patientId, therapistId, typeId, startAt, patientNote,
    therapistNote, isBlocker, blockerNote,
    recurrence, // { freq, dayOfWeek, startTime, count, until }
  } = body

  const type = await prisma.appointmentType.findUnique({ where: { id: typeId } })
  if (!type) return NextResponse.json({ error: 'Termintyp nicht gefunden' }, { status: 404 })

  const isTherapistOrAdmin = ['ADMIN', 'THERAPIST'].includes(role)
  const status = isTherapistOrAdmin ? 'CONFIRMED' : 'PENDING'

  // Terminserie
  if (recurrence && isTherapistOrAdmin) {
    const slots = expandRecurrence(recurrence, type.durationMin, therapistId || userId, typeId, patientId)
    const rule = await prisma.recurringRule.create({
      data: {
        freq: recurrence.freq,
        dayOfWeek: recurrence.dayOfWeek,
        startTime: recurrence.startTime,
        count: recurrence.count ?? slots.length,
        until: recurrence.until ? new Date(recurrence.until) : null,
      },
    })

    const appointments = await prisma.$transaction(
      slots.map(s => prisma.appointment.create({
        data: {
          patientId: patientId || null,
          therapistId: therapistId || userId,
          typeId,
          startAt: s.startAt,
          endAt: s.endAt,
          status,
          isBlocker: isBlocker ?? false,
          blockerNote: blockerNote || null,
          therapistNote: therapistNote || null,
          recurrenceId: rule.id,
        },
      }))
    )

    await prisma.auditLog.create({
      data: { userId, patientId: patientId || null, action: 'APPOINTMENT_CREATED',
              details: { count: appointments.length, recurrence: true } },
    }).catch(() => {})

    return NextResponse.json({ created: appointments.length, ruleId: rule.id })
  }

  // Einzeltermin
  const endAt = new Date(new Date(startAt).getTime() + type.durationMin * 60000)

  const appointment = await prisma.appointment.create({
    data: {
      patientId: patientId || null,
      therapistId: therapistId || userId,
      typeId,
      startAt: new Date(startAt),
      endAt,
      status,
      isBlocker: isBlocker ?? false,
      blockerNote: blockerNote || null,
      patientNote: patientNote || null,
      therapistNote: therapistNote || null,
    },
    include: { type: true, therapist: { select: { name: true } }, patient: { select: { firstName: true, lastName: true } } },
  })

  if (status === 'CONFIRMED') {
    await notifyAppointment(appointment.id, 'CONFIRMED').catch(() => {})
  }

  await prisma.auditLog.create({
    data: { userId, patientId: patientId || null, action: 'APPOINTMENT_CREATED' },
  }).catch(() => {})

  return NextResponse.json(appointment)
}

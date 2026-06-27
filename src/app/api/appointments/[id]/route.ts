import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyAppointment } from '@/lib/calendar'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const appt = await prisma.appointment.findUnique({ where: { id: params.id } })
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status, therapistNote, cancelReason, affectSeries } = body

  // Stornierung einer ganzen Serie
  if (status === 'CANCELLED' && affectSeries && appt.recurrenceId) {
    const future = await prisma.appointment.updateMany({
      where: {
        recurrenceId: appt.recurrenceId,
        startAt: { gte: new Date() },
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userId, cancelReason: cancelReason || null },
    })

    // Warteliste prüfen
    await checkWaitlist(appt.therapistId, appt.typeId)

    return NextResponse.json({ cancelled: future.count })
  }

  const updated = await prisma.appointment.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(therapistNote !== undefined && { therapistNote }),
      ...(status === 'CANCELLED' && {
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancelReason: cancelReason || null,
      }),
    },
    include: { type: true, patient: { select: { firstName: true, lastName: true } } },
  })

  // Benachrichtigungen
  if (status === 'CONFIRMED') {
    await notifyAppointment(params.id, 'CONFIRMED').catch(() => {})
    await prisma.auditLog.create({
      data: { userId, patientId: appt.patientId, action: 'APPOINTMENT_CONFIRMED' }
    }).catch(() => {})
  }
  if (status === 'CANCELLED') {
    await notifyAppointment(params.id, 'CANCELLED').catch(() => {})
    await checkWaitlist(appt.therapistId, appt.typeId)
    await prisma.auditLog.create({
      data: { userId, patientId: appt.patientId, action: 'APPOINTMENT_CANCELLED' }
    }).catch(() => {})
  }
  if (status === 'NO_SHOW') {
    await prisma.auditLog.create({
      data: { userId, patientId: appt.patientId, action: 'APPOINTMENT_NO_SHOW' }
    }).catch(() => {})
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.appointment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

// Warteliste prüfen und nächsten Patienten benachrichtigen
async function checkWaitlist(therapistId: string, typeId: string) {
  const next = await prisma.waitlistEntry.findFirst({
    where: { therapistId, status: 'WAITING' },
    include: { patient: { include: { patientUser: true } } },
    orderBy: { createdAt: 'asc' },
  })
  if (!next || !next.patient.patientUserId) return

  await prisma.waitlistEntry.update({
    where: { id: next.id },
    data: { status: 'OFFERED', offeredAt: new Date() },
  })

  await prisma.notification.create({
    data: {
      userId: next.patient.patientUserId,
      channel: 'IN_APP',
      subject: 'Termin verfügbar',
      body: 'Ein Termin bei Ihrem Therapeuten ist jetzt verfügbar. Bitte buchen Sie ihn bald.',
      status: 'PENDING',
    },
  })
}

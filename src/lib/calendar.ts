import { prisma } from './prisma'

export interface FreeSlot {
  startAt: Date
  endAt: Date
  therapistId: string
  therapistName: string
}

// Berechnet freie Buchungsslots für einen Therapeuten in einem Zeitraum
export async function getFreeSlotsForTherapist(
  therapistId: string,
  from: Date,
  to: Date,
  durationMin: number,
): Promise<FreeSlot[]> {
  const therapist = await prisma.user.findUnique({ where: { id: therapistId } })
  if (!therapist) return []

  // Verfügbarkeitsslots laden
  const availability = await prisma.availabilitySlot.findMany({
    where: {
      therapistId,
      OR: [
        { validFrom: null },
        { validFrom: { lte: to } },
      ],
      AND: [
        { OR: [{ validUntil: null }, { validUntil: { gte: from } }] },
      ],
    },
  })

  // Bestehende Termine laden
  const booked = await prisma.appointment.findMany({
    where: {
      therapistId,
      status: { notIn: ['CANCELLED'] },
      startAt: { gte: from, lte: to },
    },
  })

  // Abwesenheiten laden
  const absences = await prisma.absence.findMany({
    where: {
      therapistId,
      startAt: { lte: to },
      endAt: { gte: from },
    },
  })

  const slots: FreeSlot[] = []
  const current = new Date(from)

  while (current < to) {
    const dayOfWeek = (current.getDay() + 6) % 7 // 0=Mo, 6=So
    const avail = availability.filter(a => a.dayOfWeek === dayOfWeek)

    for (const slot of avail) {
      const [sh, sm] = slot.startTime.split(':').map(Number)
      const [eh, em] = slot.endTime.split(':').map(Number)

      let cursor = new Date(current)
      cursor.setHours(sh, sm, 0, 0)
      const end = new Date(current)
      end.setHours(eh, em, 0, 0)

      while (cursor < end) {
        const slotEnd = new Date(cursor.getTime() + durationMin * 60000)
        if (slotEnd > end) break

        // Abwesenheits-Check
        const inAbsence = absences.some(a => cursor < a.endAt && slotEnd > a.startAt)
        if (!inAbsence) {
          // Buchungs-Überschneidungscheck
          const isBooked = booked.some(b => cursor < b.endAt && slotEnd > b.startAt)
          if (!isBooked) {
            slots.push({
              startAt: new Date(cursor),
              endAt: new Date(slotEnd),
              therapistId,
              therapistName: therapist.name ?? '',
            })
          }
        }
        cursor = new Date(cursor.getTime() + durationMin * 60000)
      }
    }

    current.setDate(current.getDate() + 1)
    current.setHours(0, 0, 0, 0)
  }

  return slots
}

// Erstellt Termine aus einer RecurringRule
export function expandRecurrence(
  rule: { freq: string; dayOfWeek: number; startTime: string; count?: number | null; until?: Date | null },
  durationMin: number,
  therapistId: string,
  typeId: string,
  patientId?: string,
): Array<{ startAt: Date; endAt: Date }> {
  const results: Array<{ startAt: Date; endAt: Date }> = []
  const [h, m] = rule.startTime.split(':').map(Number)

  // Nächsten passenden Wochentag finden
  const now = new Date()
  const targetDay = rule.dayOfWeek // 0=Mo
  const currentDay = (now.getDay() + 6) % 7
  let daysUntil = (targetDay - currentDay + 7) % 7
  if (daysUntil === 0) daysUntil = 7

  const cursor = new Date(now)
  cursor.setDate(cursor.getDate() + daysUntil)
  cursor.setHours(h, m, 0, 0)

  const intervalDays = rule.freq === 'WEEKLY' ? 7 : rule.freq === 'BIWEEKLY' ? 14 : 30
  const maxCount = rule.count ?? 52 // max 1 Jahr

  for (let i = 0; i < maxCount; i++) {
    if (rule.until && cursor > rule.until) break
    const endAt = new Date(cursor.getTime() + durationMin * 60000)
    results.push({ startAt: new Date(cursor), endAt })
    cursor.setDate(cursor.getDate() + intervalDays)
  }

  return results
}

// Benachrichtigung senden (queued)
export async function scheduleNotification(data: {
  userId: string
  appointmentId?: string
  channel: 'EMAIL' | 'SMS' | 'IN_APP'
  subject?: string
  body: string
  scheduledFor?: Date
}) {
  return prisma.notification.create({ data: { ...data, status: 'PENDING' } })
}

export async function notifyAppointment(
  appointmentId: string,
  event: 'CONFIRMED' | 'CANCELLED' | 'REMINDER',
) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { patientUser: true } },
      therapist: true,
      type: true,
    },
  })
  if (!appt) return

  const date = new Intl.DateTimeFormat('de-AT', { dateStyle: 'full', timeStyle: 'short' }).format(appt.startAt)

  const messages = {
    CONFIRMED: {
      subject: `Termin bestätigt – ${date}`,
      body: `Ihr Termin "${appt.type.name}" am ${date} wurde bestätigt.`,
    },
    CANCELLED: {
      subject: `Termin abgesagt – ${date}`,
      body: `Ihr Termin "${appt.type.name}" am ${date} wurde leider abgesagt.`,
    },
    REMINDER: {
      subject: `Terminerinnerung – ${date}`,
      body: `Erinnerung: Ihr Termin "${appt.type.name}" findet am ${date} statt.`,
    },
  }

  const msg = messages[event]

  // Patient benachrichtigen
  if (appt.patient?.patientUserId) {
    const settings = await prisma.notificationSetting.findUnique({
      where: { userId: appt.patient.patientUserId }
    })
    if (settings?.inAppEnabled) {
      await scheduleNotification({
        userId: appt.patient.patientUserId,
        appointmentId,
        channel: 'IN_APP',
        subject: msg.subject,
        body: msg.body,
      })
    }
  }

  // Therapeut benachrichtigen (In-App)
  if (event !== 'REMINDER') {
    await scheduleNotification({
      userId: appt.therapistId,
      appointmentId,
      channel: 'IN_APP',
      subject: msg.subject,
      body: `Patient: ${appt.patient?.firstName} ${appt.patient?.lastName} – ${msg.body}`,
    })
  }
}

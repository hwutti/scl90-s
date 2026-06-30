import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

// ─── Sitzungs-Preisberechnung ─────────────────────────────────────────────────

export function calculateSessionPrice(params: {
  billingMode: 'time' | 'unit'
  durationMinutes?: number
  unitCount?: number
  unitLengthMinutes?: number
  unitPriceNet?: number
  hourlyRateNet?: number
}): number | null {
  const { billingMode, durationMinutes, unitCount, unitPriceNet, hourlyRateNet } = params

  if (billingMode === 'time') {
    // Der eingegebene Betrag IST der Sitzungspreis - keine Skalierung nach
    // tatsächlicher Dauer. "Dauer" dient hier nur der Dokumentation
    // (Sitzungsprotokoll), nicht der Preisberechnung.
    if (!hourlyRateNet) return null
    return hourlyRateNet
  } else {
    if (!unitCount || !unitPriceNet) return null
    return unitCount * unitPriceNet
  }
}

// ─── Sitzungs-Abrechnungsstatus ableiten ──────────────────────────────────────
// WICHTIG: Status wird nie manuell gesetzt, immer aus Allocations berechnet!

export async function deriveSessionBillingStatus(sessionId: string): Promise<string> {
  const session = await prisma.therapySession.findUnique({
    where: { id: sessionId },
    select: { excludedFromFinances: true },
  })

  if (!session) return 'UNBILLED'
  if (session.excludedFromFinances) return 'EXCLUDED'

  const allocations = await prisma.txSessionAllocation.findMany({
    where: {
      sessionId,
      isActive: true,
      transaction: { lifecycleStatus: 'ACTIVE' },
    },
    include: { transaction: { select: { paymentStatus: true } } },
  })

  if (allocations.length === 0) return 'UNBILLED'

  const allPaid = allocations.every(a => a.transaction.paymentStatus === 'PAID')
  return allPaid ? 'PAID' : 'BILLED_UNPAID'
}

// ─── Sitzungs-Status neu berechnen und in DB schreiben ────────────────────────

export async function recalcSessionBillingStatus(sessionId: string): Promise<void> {
  const status = await deriveSessionBillingStatus(sessionId)
  await prisma.therapySession.update({
    where: { id: sessionId },
    data: { billingStatus: status as any },
  })
}

// ─── Session aus Kalendertermin erstellen (atomar) ───────────────────────────

export async function createSessionFromAppointment(params: {
  appointmentId: string
  therapistId: string
  serviceLabel?: string
}): Promise<{ id: string }> {
  return await prisma.$transaction(async (tx) => {
    // 1. Termin laden und prüfen
    const appt = await tx.appointment.findUnique({
      where: { id: params.appointmentId },
      include: { patient: true, type: true, therapySession: true },
    })
    if (!appt) throw new Error('Termin nicht gefunden')
    if (!appt.patientId) throw new Error('Termin hat keinen Patienten')
    if (appt.therapySession) throw new Error('Aus diesem Termin wurde bereits eine Sitzung erstellt')

    // 2. Laufende Sessionsnummer ermitteln
    const count = await tx.therapySession.count({
      where: { patientId: appt.patientId },
    })
    const sessionNumber = count + 1

    // 3. Sitzung erstellen
    const durationMinutes = appt.startAt && appt.endAt
      ? Math.round((appt.endAt.getTime() - appt.startAt.getTime()) / 60000)
      : appt.type.durationMin ?? 50

    const session = await tx.therapySession.create({
      data: {
        patientId: appt.patientId,
        therapistId: params.therapistId,
        appointmentId: params.appointmentId,
        name: `Sitzung-${sessionNumber} · ${appt.startAt.toLocaleDateString('de-AT')}`,
        sessionNumber,
        source: 'APPOINTMENT',
        sessionDate: appt.startAt,
        startTime: appt.startAt,
        endTime: appt.endAt,
        durationMinutes,
        serviceLabel: params.serviceLabel,
        billingStatus: 'UNBILLED',
      },
    })

    // 4. Termin mit Session verknüpfen
    await tx.appointment.update({
      where: { id: params.appointmentId },
      data: { sessionId: session.id } as any,
    })

    // 5. Timeline-Eintrag
    await tx.profileTimelineEvent.create({
      data: {
        patientId: appt.patientId,
        eventType: 'session_created',
        relatedEntityType: 'therapy_session',
        relatedEntityId: session.id,
        title: `Sitzung ${sessionNumber} erstellt`,
        summary: `Aus Kalendertermin am ${appt.startAt.toLocaleDateString('de-AT')}`,
        eventDate: new Date(),
        createdByUserId: params.therapistId,
      },
    })

    return { id: session.id }
  })
}

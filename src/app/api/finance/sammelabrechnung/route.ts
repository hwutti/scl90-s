import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createTransactionFromSessions } from '@/lib/services/transaction.service'

// GET: Alle Patienten mit offenen Sitzungen im Zeitraum
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const where: any = {
    billingStatus: 'UNBILLED',
    excludedFromFinances: false,
  }
  if (from) where.sessionDate = { ...where.sessionDate, gte: new Date(from) }
  if (to)   where.sessionDate = { ...where.sessionDate, lte: new Date(to + 'T23:59:59') }

  const sessions = await prisma.therapySession.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true, firstName: true, lastName: true,
          billRecipientName: true, billRecipientAddress: true, billRecipientCity: true,
          defaultVatRate: true, defaultPaymentMethod: true, defaultMarkAsPaid: true,
          defaultInvoiceTemplateId: true,
        },
      },
    },
    orderBy: [{ patient: { lastName: 'asc' } }, { sessionDate: 'asc' }, { sessionNumber: 'asc' }],
  })

  // Gruppieren nach Patient
  const byPatient = new Map<string, {
    patient: any
    sessions: any[]
    totalNet: number
  }>()

  for (const s of sessions) {
    if (!s.patient) continue
    const pid = s.patient.id
    if (!byPatient.has(pid)) {
      byPatient.set(pid, { patient: s.patient, sessions: [], totalNet: 0 })
    }
    const entry = byPatient.get(pid)!
    entry.sessions.push({ id: s.id, name: s.name, sessionDate: s.sessionDate, calculatedPriceNet: s.calculatedPriceNet, durationMinutes: s.durationMinutes })
    entry.totalNet += parseFloat(s.calculatedPriceNet?.toString() ?? '0')
  }

  return NextResponse.json({
    patients: Array.from(byPatient.values()),
    totalPatients: byPatient.size,
    totalSessions: sessions.length,
    totalNet: sessions.reduce((s, x) => s + parseFloat(x.calculatedPriceNet?.toString() ?? '0'), 0),
  })
}

// POST: Sammelabrechnung durchführen
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  // body.items = [{ patientId, sessionIds, payerName, payerAddress, vatRate, paymentMethod, markAsPaid, invoiceTemplateId }]
  const items: any[] = body.items ?? []

  const results: { patientId: string; referenceNumber?: string; error?: string }[] = []

  for (const item of items) {
    try {
      const result = await createTransactionFromSessions({
        sessionIds:         item.sessionIds,
        patientId:          item.patientId,
        payerName:          item.payerName,
        payerAddress:       item.payerAddress ?? '',
        payeeName:          session.user?.name ?? '',
        vatRate:            item.vatRate ?? 0,
        markAsPaid:         item.markAsPaid ?? false,
        paymentMethod:      item.paymentMethod ?? 'UNBAR_BANK_TRANSFER',
        generateInvoiceDoc: item.generateInvoiceDoc ?? true,
        anonymizeInvoice:   false,
        invoiceTemplateId:  item.invoiceTemplateId ?? null,
        createdByUserId:    userId,
      })
      results.push({ patientId: item.patientId, referenceNumber: result.referenceNumber })
    } catch (e: any) {
      results.push({ patientId: item.patientId, error: e.message })
    }
  }

  const ok  = results.filter(r => !r.error).length
  const err = results.filter(r => r.error).length
  return NextResponse.json({ results, ok, errors: err })
}

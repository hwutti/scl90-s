import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderDraftInvoiceHtml } from '@/lib/invoice/template'

// Reine Lese-Vorschau: zeigt, wie die Honorarnote aussehen würde, BEVOR
// irgendetwas erstellt/gespeichert wird (keine Transaktion, kein LineItem,
// keine Referenznummer-Reservierung, kein InvoiceDocument).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sessionIds: string[] = Array.isArray(body.sessionIds) ? body.sessionIds : []
  if (sessionIds.length === 0) {
    return NextResponse.json({ error: 'Keine Sitzungen ausgewählt' }, { status: 400 })
  }

  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    select: { defaultInvoiceTemplateId: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient nicht gefunden' }, { status: 404 })

  const sessions = await prisma.therapySession.findMany({
    where: { id: { in: sessionIds }, patientId: params.id },
    orderBy: { sessionDate: 'asc' },
  })
  if (sessions.length === 0) {
    return NextResponse.json({ error: 'Sitzungen nicht gefunden' }, { status: 404 })
  }

  const lineItems = sessions.map(s => {
    const amountNet = parseFloat(s.calculatedPriceNet?.toString() ?? '0')
    return {
      date: s.sessionDate,
      description: `Sitzung-${s.sessionNumber}`,
      serviceLabel: s.serviceLabel ?? null,
      quantity: 1,
      unitPriceNet: amountNet,
      amountNet,
    }
  })

  const templateId = body.invoiceTemplateId || patient.defaultInvoiceTemplateId || null
  const vatRate = typeof body.vatRate === 'number' ? body.vatRate : 0

  try {
    const html = await renderDraftInvoiceHtml({
      templateId,
      payerName: body.payerName || 'Patient',
      payerAddress: body.payerAddress || '',
      vatRate,
      notes: body.notes || '',
      lineItems,
    })
    return NextResponse.json({ html })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Vorschau fehlgeschlagen' }, { status: 500 })
  }
}

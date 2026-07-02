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

  // Zusatzleistungen je Sitzung laden — müssen in der Vorschau genauso auftauchen
  // wie später in der tatsächlich erstellten Rechnung (siehe transaction.service.ts)
  const serviceLines = await prisma.sessionServiceLine.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: [{ sessionId: 'asc' }, { sortOrder: 'asc' }],
  })
  const serviceLinesBySession = new Map<string, typeof serviceLines>()
  for (const line of serviceLines) {
    const list = serviceLinesBySession.get(line.sessionId) ?? []
    list.push(line)
    serviceLinesBySession.set(line.sessionId, list)
  }

  const overrides: Record<string, any> = body.lineItemOverrides ?? {}
  const removedKeys = new Set<string>(Array.isArray(body.removedLineKeys) ? body.removedLineKeys : [])

  const lineItems = sessions.flatMap(s => {
    const baseKey = `session:${s.id}`
    const baseOverride = overrides[baseKey]
    const baseAmountNet = baseOverride?.unitPriceNet ?? parseFloat(s.calculatedPriceNet?.toString() ?? '0')
    const baseQuantity = baseOverride?.quantity ?? 1
    const baseLine = removedKeys.has(baseKey) ? null : {
      date: s.sessionDate,
      description: baseOverride?.description ?? `Sitzung-${s.sessionNumber}`,
      descriptionHtml: baseOverride?.descriptionHtml ?? null,
      serviceLabel: s.serviceLabel ?? null,
      quantity: baseQuantity,
      unitPriceNet: baseAmountNet,
      amountNet: baseQuantity * baseAmountNet,
    }
    const extraLines = (serviceLinesBySession.get(s.id) ?? [])
      .filter(l => !removedKeys.has(`service:${l.id}`))
      .map(l => {
        const lineOverride = overrides[`service:${l.id}`]
        const qty = lineOverride?.quantity ?? parseFloat(l.quantity.toString())
        const unitPrice = lineOverride?.unitPriceNet ?? parseFloat(l.unitPriceNet.toString())
        return {
          date: s.sessionDate,
          description: lineOverride?.description ?? l.description,
          descriptionHtml: lineOverride?.descriptionHtml ?? null,
          serviceLabel: l.catalogCode ?? null,
          quantity: qty,
          unitPriceNet: unitPrice,
          amountNet: qty * unitPrice,
        }
      })
    return baseLine ? [baseLine, ...extraLines] : extraLines
  })

  // Frei hinzugefügte Positionen ohne Sitzungsbezug ebenfalls in der Vorschau zeigen
  const manualLines = Array.isArray(body.manualLines) ? body.manualLines : []
  for (const ml of manualLines) {
    const qty = ml.quantity ?? 1
    const unitPrice = ml.unitPriceNet ?? 0
    lineItems.push({
      date: ml.lineDate ? new Date(ml.lineDate) : new Date(),
      description: ml.description?.trim() || 'Position',
      descriptionHtml: ml.descriptionHtml ?? null,
      serviceLabel: null,
      quantity: qty,
      unitPriceNet: unitPrice,
      amountNet: qty * unitPrice,
    })
  }

  const templateId = body.invoiceTemplateId || patient.defaultInvoiceTemplateId || null
  const vatRate = typeof body.vatRate === 'number' ? body.vatRate : 0

  try {
    const html = await renderDraftInvoiceHtml({
      templateId,
      payerName: body.payerName || 'Patient',
      payerAddress: body.payerAddress || '',
      vatRate,
      notes: body.notes || '',
      customNoteHtml: body.customNoteHtml || '',
      lineItems,
    })
    return NextResponse.json({ html })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Vorschau fehlgeschlagen' }, { status: 500 })
  }
}

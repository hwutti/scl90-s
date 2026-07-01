import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderDraftInvoiceHtml } from '@/lib/invoice/template'

// Reine Lese-Vorschau, bevor irgendetwas erstellt wird -- analog zu
// /api/patients/[id]/abrechnen/preview, aber mit frei editierbaren lineItems
// statt starr aus Sitzungen abgeleiteten Positionen.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const lineItems: any[] = Array.isArray(body.lineItems) ? body.lineItems : []
  if (lineItems.length === 0) {
    return NextResponse.json({ error: 'Keine Positionen vorhanden' }, { status: 400 })
  }

  const partner = await prisma.cooperationPartner.findUnique({
    where: { id: params.id },
    select: { defaultInvoiceTemplateId: true },
  })
  if (!partner) return NextResponse.json({ error: 'Kooperationspartner nicht gefunden' }, { status: 404 })

  const previewLines = lineItems.map(l => {
    const qty = parseFloat(l.quantity ?? 1)
    const unitPriceNet = parseFloat(l.unitPriceNet ?? 0)
    return {
      date: l.lineDate ? new Date(l.lineDate) : null,
      description: l.description ?? '',
      serviceLabel: l.patientName ?? null,
      quantity: qty,
      unitPriceNet,
      amountNet: qty * unitPriceNet,
    }
  })

  const templateId = body.invoiceTemplateId || partner.defaultInvoiceTemplateId || null
  const vatRate = typeof body.vatRate === 'number' ? body.vatRate : 0

  try {
    const html = await renderDraftInvoiceHtml({
      templateId,
      usePartnerTemplates: true,
      payerName: body.payerName || 'Kooperationspartner',
      payerAddress: body.payerAddress || '',
      vatRate,
      notes: body.notes || '',
      lineItems: previewLines,
    })
    return NextResponse.json({ html })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Vorschau fehlgeschlagen' }, { status: 500 })
  }
}

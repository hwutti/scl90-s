import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: einzelnen Entwurf laden (zum Weiterbearbeiten)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const draft = await prisma.invoiceDraft.findUnique({ where: { id: params.id } })
  if (!draft) return NextResponse.json({ error: 'Entwurf nicht gefunden' }, { status: 404 })
  return NextResponse.json({ draft })
}

// PATCH: bestehenden Entwurf aktualisieren (beim "Entwurf speichern"-Klick)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const draft = await prisma.invoiceDraft.update({
    where: { id: params.id },
    data: {
      sessionIds: body.sessionIds ?? [],
      lineItemOverrides: body.lineItemOverrides ?? {},
      manualLines: body.manualLines ?? [],
      removedLineKeys: body.removedLineKeys ?? [],
      customNoteHtml: body.customNoteHtml ?? null,
      payerName: body.payerName ?? null,
      payerAddress: body.payerAddress ?? null,
      vatRate: body.vatRate ?? null,
      paymentMethod: body.paymentMethod ?? null,
      markAsPaid: Boolean(body.markAsPaid),
      generateInvoiceDoc: body.generateInvoiceDoc !== false,
      anonymizeInvoice: Boolean(body.anonymizeInvoice),
      invoiceTemplateId: body.invoiceTemplateId ?? null,
      notes: body.notes ?? null,
    },
  })
  return NextResponse.json({ id: draft.id })
}

// DELETE: Entwurf verwerfen (oder nach erfolgreichem Erstellen der echten Rechnung aufräumen)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.invoiceDraft.delete({ where: { id: params.id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}

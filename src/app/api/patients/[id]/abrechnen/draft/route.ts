import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: alle Entwürfe für diesen Patienten auflisten (für "Entwurf weiterbearbeiten"-Hinweis)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const drafts = await prisma.invoiceDraft.findMany({
    where: { patientId: params.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, updatedAt: true, createdAt: true, sessionIds: true },
  })
  return NextResponse.json({ drafts })
}

// POST: neuen Entwurf anlegen, gibt die neue draftId zurück
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const draft = await prisma.invoiceDraft.create({
    data: {
      patientId: params.id,
      createdByUserId: (session.user as any).id,
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

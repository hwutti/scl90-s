import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderInvoiceHtmlForTransaction } from '@/lib/invoice/template'

// PATCH /api/transactions/[id]/line-items
// Aktualisiert Beschreibungen (inkl. Rich-Text HTML) und den optionalen
// Freitext-Bereich einer noch nicht bezahlten/stornierten Transaktion.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { lineItems, customNoteHtml } = body as {
    lineItems?: { id: string; description: string; descriptionHtml?: string | null }[]
    customNoteHtml?: string | null
  }

  // Sicherheitscheck: nur UNPAID/ACTIVE Transaktionen dürfen bearbeitet werden
  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    select: { paymentStatus: true, lifecycleStatus: true },
  })
  if (!tx) return NextResponse.json({ error: 'Transaktion nicht gefunden' }, { status: 404 })
  if (tx.paymentStatus === 'PAID') {
    return NextResponse.json({ error: 'Bezahlte Rechnungen können nicht bearbeitet werden' }, { status: 400 })
  }
  if (tx.lifecycleStatus !== 'ACTIVE') {
    return NextResponse.json({ error: 'Stornierte Rechnungen können nicht bearbeitet werden' }, { status: 400 })
  }

  // LineItems einzeln aktualisieren
  if (lineItems?.length) {
    await Promise.all(lineItems.map(li =>
      prisma.txLineItem.update({
        where: { id: li.id },
        data: {
          description: li.description,
          descriptionHtml: li.descriptionHtml ?? null,
        },
      })
    ))
  }

  // Freitext-Bereich
  if (customNoteHtml !== undefined) {
    await prisma.transaction.update({
      where: { id: params.id },
      data: { customNoteHtml: customNoteHtml ?? null },
    })
  }

  // Gespeichertes Rechnungs-Snapshot (InvoiceDocument) neu rendern, sonst
  // bleiben Änderungen an Beschreibungen/Freitext in Anzeige & PDF unsichtbar,
  // da die Rechnung normalerweise nur einmalig beim Erstellen gerendert wird.
  try {
    const newHtml = await renderInvoiceHtmlForTransaction(params.id)
    const existingDoc = await prisma.invoiceDocument.findFirst({
      where: { transactionId: params.id, documentType: 'INVOICE_PDF' },
    })
    if (existingDoc) {
      await prisma.invoiceDocument.update({
        where: { id: existingDoc.id },
        data: { data: Buffer.from(newHtml, 'utf8') },
      })
    } else {
      await prisma.invoiceDocument.create({
        data: {
          transactionId: params.id,
          documentType: 'INVOICE_PDF',
          format: 'html',
          anonymized: false,
          data: Buffer.from(newHtml, 'utf8'),
          mimeType: 'text/html',
        },
      })
    }
  } catch (e) {
    console.error('[line-items] Snapshot-Neu-Rendering fehlgeschlagen:', e)
    // nicht kritisch - Rohdaten sind bereits gespeichert, Snapshot wird beim
    // nächsten Anzeigen/Drucken ggf. veraltet angezeigt
  }

  return NextResponse.json({ ok: true })
}

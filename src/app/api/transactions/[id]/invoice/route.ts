import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderInvoiceHtmlForTransaction } from '@/lib/invoice/template'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Gleiche Regel wie bei GET: existiert bereits ein Snapshot, wird NICHT neu
  // gerendert (sonst würden spätere Branding-/Vorlagen-Änderungen die bereits
  // ausgestellte Rechnung nachträglich verändern).
  const existing = await prisma.invoiceDocument.findFirst({
    where: { transactionId: tx.id, deletedAt: null, format: 'html' },
    orderBy: { createdAt: 'asc' },
  })

  let html: string
  if (existing?.data) {
    html = existing.data.toString('utf8')
  } else {
    html = await renderInvoiceHtmlForTransaction(tx.id)
    await prisma.invoiceDocument.create({
      data: {
        transactionId: tx.id,
        documentType: 'INVOICE_PDF',
        format: 'html',
        anonymized: body.anonymized ?? false,
        data: Buffer.from(html, 'utf8'),
        mimeType: 'text/html',
      },
    })
  }

  return NextResponse.json({ html })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
  if (!tx) return new NextResponse('Not found', { status: 404 })

  // Eine Rechnung darf sich nach dem ersten Erstellen NICHT mehr ändern, auch wenn
  // sich Branding/Steuernummer/Bankverbindung/Vorlage später ändern. Existiert
  // bereits ein eingefrorenes Snapshot, wird IMMER dieses verwendet statt live
  // neu zu rendern.
  let body: string
  const existing = await prisma.invoiceDocument.findFirst({
    where: { transactionId: tx.id, deletedAt: null, format: 'html' },
    orderBy: { createdAt: 'asc' },
  })

  if (existing?.data) {
    body = existing.data.toString('utf8')
  } else {
    // Noch kein Snapshot vorhanden -> einmalig live rendern und dauerhaft einfrieren
    body = await renderInvoiceHtmlForTransaction(tx.id)
    await prisma.invoiceDocument.create({
      data: {
        transactionId: tx.id,
        documentType: 'INVOICE_PDF',
        format: 'html',
        data: Buffer.from(body, 'utf8'),
        mimeType: 'text/html',
      },
    })
  }

  const printHtml = `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8">
<title>Honorarnote ${tx.referenceNumber}</title>
<style>
  @media print { @page { margin: 0; size: A4; } .no-print { display: none !important; } }
  body { margin: 0; }
</style>
</head><body>
<div class="no-print" style="position:fixed;top:12px;right:12px;z-index:9999;display:flex;gap:8px">
  <button onclick="window.print()" style="padding:8px 18px;background:#4f46e5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:sans-serif">
    🖨 Drucken / Als PDF speichern
  </button>
  <button onclick="window.close()" style="padding:8px 14px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:sans-serif">
    ✕ Schließen
  </button>
</div>
${body}
</body></html>`

  return new NextResponse(printHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })
  await prisma.invoiceDocument.update({ where: { id: docId }, data: { deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

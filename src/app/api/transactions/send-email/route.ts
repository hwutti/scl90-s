import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMail, buildInvoiceEmail } from '@/lib/email/mailer'
import { getBranding } from '@/lib/branding'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transactionId, toEmail, ccEmail, message } = await req.json()

  if (!transactionId || !toEmail) {
    return NextResponse.json({ error: 'transactionId und toEmail sind Pflicht.' }, { status: 400 })
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!tx) return NextResponse.json({ error: 'Transaktion nicht gefunden.' }, { status: 404 })

  const branding = await getBranding()
  const praxisName = branding.praxisName || 'Psychotherapeutische Praxis'

  const fmtEUR = (n: any) => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n ?? 0))
  const patientName = tx.payerName || `${tx.patient?.firstName ?? ''} ${tx.patient?.lastName ?? ''}`.trim()
  const { subject, html, text } = buildInvoiceEmail({
    patientName,
    referenceNumber: tx.referenceNumber,
    amount: fmtEUR(tx.amountGross),
    praxisName,
  })

  // Honorarnote als Anhang laden (falls vorhanden)
  const attachments: any[] = []
  const invoiceDoc = await prisma.patientDocument.findFirst({
    where: {
      patientId: tx.patientId ?? undefined,
      documentType: 'INVOICE',
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Benutzerdefinierte Nachricht hinzufügen
  const finalHtml = message
    ? html.replace('Bei Fragen stehe ich Ihnen gerne zur Verfügung.', `${message}<br><br>Bei Fragen stehe ich Ihnen gerne zur Verfügung.`)
    : html

  const result = await sendMail({
    to: toEmail,
    replyTo: ccEmail || undefined,
    subject,
    html: finalHtml,
    text,
    attachments,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // E-Mail-Versand im Audit-Log festhalten
  await prisma.auditLog.create({
    data: {
      action: 'EMAIL_SENT',
      entityType: 'Transaction',
      entityId: transactionId,
      userId: (session.user as any).id,
      details: JSON.stringify({ to: toEmail, subject }),
    },
  }).catch(() => {}) // Audit-Log-Fehler ignorieren

  return NextResponse.json({ ok: true })
}

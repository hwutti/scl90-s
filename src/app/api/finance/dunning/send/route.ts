import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveDueDate } from '@/lib/finance/dueDate'
import { getBranding } from '@/lib/branding'
import { sendMail, buildDunningEmail } from '@/lib/email/mailer'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { DunningPdf } from '@/lib/pdf/DunningPdf'

const fmtEUR = (n: number) => n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtDate = (d: Date) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'long' }).format(d)

// POST /api/finance/dunning/send
// Body: { transactionId, level, sendEmail? } - sendEmail default true (nur falls E-Mail vorhanden)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { transactionId, level } = body
  const sendEmail = body.sendEmail !== false
  if (!transactionId || !['ERINNERUNG', 'MAHNUNG_1', 'MAHNUNG_2'].includes(level)) {
    return NextResponse.json({ error: 'transactionId und gueltiges level erforderlich' }, { status: 400 })
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      patient: { select: { email: true, defaultInvoiceTemplateId: true } },
      dunnings: { orderBy: { sentAt: 'desc' }, take: 1 },
    },
  })
  if (!tx) return NextResponse.json({ error: 'Transaktion nicht gefunden' }, { status: 404 })
  if (role !== 'ADMIN' && tx.createdByUserId !== userId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
  if (tx.paymentStatus === 'PAID' || tx.lifecycleStatus !== 'ACTIVE') {
    return NextResponse.json({ error: 'Rechnung ist bezahlt oder storniert - keine Mahnung moeglich' }, { status: 409 })
  }

  const dueDate = await resolveDueDate(tx.transactionDate, tx.invoiceTemplateId, tx.patient?.defaultInvoiceTemplateId)
  const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (24 * 3600 * 1000)))
  const previousSentAt = tx.dunnings[0] ? fmtDate(tx.dunnings[0].sentAt) : null

  const branding = await getBranding()
  const logoSrc = branding.logoBase64 ? `data:${branding.logoMimeType};base64,${branding.logoBase64}` : null

  const element = React.createElement(DunningPdf, {
    level, praxisName: branding.praxisName, praxisAddress: branding.address, logoSrc,
    letterDate: fmtDate(new Date()), payerName: tx.payerName, payerAddress: tx.payerAddress,
    referenceNumber: tx.referenceNumber, invoiceDate: fmtDate(tx.transactionDate),
    dueDate: fmtDate(dueDate), amountGross: fmtEUR(Number(tx.amountGross)), daysOverdue, previousSentAt,
  }) as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>

  const pdfBuffer = await renderToBuffer(element)

  let emailTo: string | null = null
  if (sendEmail && tx.patient?.email) {
    const { subject, html, text } = buildDunningEmail({
      level, patientName: tx.payerName, referenceNumber: tx.referenceNumber,
      amount: fmtEUR(Number(tx.amountGross)), praxisName: branding.praxisName,
    })
    const fileLabel = level === 'ERINNERUNG' ? 'Zahlungserinnerung' : level === 'MAHNUNG_1' ? 'Mahnung-1' : 'Mahnung-2'
    const result = await sendMail({
      to: tx.patient.email, subject, html, text,
      attachments: [{ filename: `${fileLabel}-${tx.referenceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    })
    if (!result.ok) {
      return NextResponse.json({ error: `PDF erstellt, aber E-Mail-Versand fehlgeschlagen: ${result.error}` }, { status: 502 })
    }
    emailTo = tx.patient.email
  }

  const dunning = await prisma.dunning.create({
    data: {
      transactionId: tx.id, level, sentBy: userId, emailTo,
      pdf: pdfBuffer, pdfMime: 'application/pdf',
    },
  })

  await prisma.auditLog.create({
    data: { userId, action: 'DUNNING_SENT', details: { transactionId: tx.id, level, emailTo, referenceNumber: tx.referenceNumber } },
  }).catch(() => {})

  return NextResponse.json({ ok: true, dunningId: dunning.id, emailed: !!emailTo })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderInvoice, getDefaultTemplate } from '@/lib/invoice/template'
import { getBranding } from '@/lib/branding'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      patient: { select: { firstName: true, lastName: true } },
    },
  })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const branding = await getBranding()
  const { html: templateHtml, guiFields } = await getDefaultTemplate()
  const fmtEUR = (n: any) => parseFloat(n?.toString() ?? '0').toFixed(2).replace('.', ',')
  const fmtDate = (d: Date) => d.toLocaleDateString('de-AT')

  const paymentDays = guiFields?.paymentDays ?? 14
  const iban = guiFields?.iban ?? ''
  const bic  = guiFields?.bic  ?? ''
  const bankName = guiFields?.bankName ?? ''
  const paymentInfo = iban
    ? `IBAN: ${iban}${bic ? ` · BIC: ${bic}` : ''}${bankName ? ` · ${bankName}` : ''}`
    : (body.paymentInfo ?? '')

  const bgOpacity = ((guiFields?.bgImageOpacity ?? 0.08) as number).toFixed(2)
  const bgMode    = guiFields?.bgImageMode ?? 'behind'

  const invoiceData = {
    praxis_name: guiFields?.praxisName || branding.praxisName,
    praxis_slogan: branding.slogan ?? '',
    praxis_address: (guiFields?.praxisAddress || branding.address) ?? '',
    praxis_email: (guiFields?.praxisEmail || branding.contactEmail) ?? '',
    praxis_phone: (guiFields?.praxisPhone || branding.contactPhone) ?? '',
    logo_base64: branding.logoBase64 ?? '',
    logo_mime: branding.logoMimeType ?? '',
    primary_color: guiFields?.primaryColor || branding.colorPrimary,
    invoice_title: guiFields?.invoiceTitle ?? 'Honorarnote',
    tax_number: guiFields?.taxNumber ?? '',
    vat_id: guiFields?.vatId ?? '',
    footer_text: guiFields?.footerText ?? '',
    header_image_base64: guiFields?.headerImageBase64 ?? '',
    header_image_mime:   guiFields?.headerImageMime   ?? 'image/png',
    footer_image_base64: guiFields?.footerImageBase64 ?? '',
    footer_image_mime:   guiFields?.footerImageMime   ?? 'image/png',
    bg_image_base64:     guiFields?.bgImageBase64     ?? '',
    bg_image_mime:       guiFields?.bgImageMime       ?? 'image/png',
    bg_image_opacity:    bgOpacity,
    bg_is_watermark:     bgMode === 'watermark',
    reference_number: tx.referenceNumber,
    transaction_date: fmtDate(tx.transactionDate),
    due_date: fmtDate(new Date(tx.transactionDate.getTime() + paymentDays * 24 * 3600000)),
    payer_name: tx.payerName,
    payer_address: tx.payerAddress ?? '',
    amount_net: fmtEUR(tx.amountNet),
    vat_rate: (parseFloat(tx.vatRate.toString()) * 100).toFixed(0),
    vat_amount: fmtEUR(tx.vatAmount),
    amount_gross: fmtEUR(tx.amountGross),
    is_paid: tx.paymentStatus === 'PAID',
    vat_enabled: parseFloat(tx.vatRate.toString()) > 0,
    payment_info: paymentInfo,
    notes: tx.notes ?? '',
    line_items: tx.lineItems.map(li => ({
      date: li.lineDate ? fmtDate(li.lineDate) : '',
      description: li.description,
      service_label: li.serviceLabel ?? '',
      quantity: parseFloat(li.quantity.toString()).toString(),
      unit_price_net: fmtEUR(li.unitPriceNet),
      amount_net: fmtEUR(li.amountNet),
    })),
  }

  // QR-Code Platzhalter
  const qrPlaceholder = (guiFields?.showQrCode && iban)
    ? `<div style="margin-top:8px"><em style="font-size:9pt;color:#888">[SEPA QR: ${iban}]</em></div>`
    : ''
  let tmpl = templateHtml.replace(/\{\{qr_code\}\}/g, qrPlaceholder)
  const html = renderInvoice(tmpl, invoiceData)

  // Einmalig ein InvoiceDocument anlegen falls noch keines existiert
  const existing = await prisma.invoiceDocument.findFirst({
    where: { transactionId: tx.id, deletedAt: null },
  })
  if (!existing) {
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

  // HTML direkt rendern (für Drucken/Vorschau im Browser)
  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      patient: { select: { firstName: true, lastName: true } },
    },
  })
  if (!tx) return new NextResponse('Not found', { status: 404 })

  const branding = await getBranding()
  const { html: templateHtml, guiFields } = await getDefaultTemplate()
  const fmtEUR = (n: any) => parseFloat(n?.toString() ?? '0').toFixed(2).replace('.', ',')
  const fmtDate = (d: Date) => d.toLocaleDateString('de-AT')

  const paymentDays = guiFields?.paymentDays ?? 14
  const iban     = guiFields?.iban     ?? ''
  const bic      = guiFields?.bic      ?? ''
  const bankName = guiFields?.bankName ?? ''
  const paymentInfo = iban
    ? `IBAN: ${iban}${bic ? ` · BIC: ${bic}` : ''}${bankName ? ` · ${bankName}` : ''}`
    : ''
  const bgOpacity = ((guiFields?.bgImageOpacity ?? 0.08) as number).toFixed(2)
  const bgMode    = guiFields?.bgImageMode ?? 'behind'
  const qrPlaceholder = (guiFields?.showQrCode && iban)
    ? `<div style="margin-top:8px"><em style="font-size:9pt;color:#888">[SEPA QR: ${iban}]</em></div>`
    : ''

  const invoiceData = {
    praxis_name:         guiFields?.praxisName         || branding.praxisName,
    praxis_slogan:       branding.slogan               ?? '',
    praxis_address:      (guiFields?.praxisAddress     || branding.address)       ?? '',
    praxis_email:        (guiFields?.praxisEmail       || branding.contactEmail)  ?? '',
    praxis_phone:        (guiFields?.praxisPhone       || branding.contactPhone)  ?? '',
    logo_base64:         branding.logoBase64           ?? '',
    logo_mime:           branding.logoMimeType         ?? '',
    primary_color:       guiFields?.primaryColor       || branding.colorPrimary,
    invoice_title:       guiFields?.invoiceTitle       ?? 'Honorarnote',
    tax_number:          guiFields?.taxNumber          ?? '',
    vat_id:              guiFields?.vatId              ?? '',
    footer_text:         guiFields?.footerText         ?? '',
    header_image_base64: guiFields?.headerImageBase64  ?? '',
    header_image_mime:   guiFields?.headerImageMime    ?? 'image/png',
    footer_image_base64: guiFields?.footerImageBase64  ?? '',
    footer_image_mime:   guiFields?.footerImageMime    ?? 'image/png',
    bg_image_base64:     guiFields?.bgImageBase64      ?? '',
    bg_image_mime:       guiFields?.bgImageMime        ?? 'image/png',
    bg_image_opacity:    bgOpacity,
    bg_is_watermark:     bgMode === 'watermark',
    reference_number:    tx.referenceNumber,
    transaction_date:    fmtDate(tx.transactionDate),
    due_date:            fmtDate(new Date(tx.transactionDate.getTime() + paymentDays * 24 * 3600000)),
    payer_name:          tx.payerName,
    payer_address:       tx.payerAddress  ?? '',
    amount_net:          fmtEUR(tx.amountNet),
    vat_rate:            (parseFloat(tx.vatRate.toString()) * 100).toFixed(0),
    vat_amount:          fmtEUR(tx.vatAmount),
    amount_gross:        fmtEUR(tx.amountGross),
    is_paid:             tx.paymentStatus === 'PAID',
    vat_enabled:         parseFloat(tx.vatRate.toString()) > 0,
    payment_info:        paymentInfo,
    notes:               tx.notes ?? '',
    line_items: tx.lineItems.map(li => ({
      date:           li.lineDate ? fmtDate(li.lineDate) : '',
      description:    li.description,
      service_label:  li.serviceLabel ?? '',
      quantity:       parseFloat(li.quantity.toString()).toString(),
      unit_price_net: fmtEUR(li.unitPriceNet),
      amount_net:     fmtEUR(li.amountNet),
    })),
  }

  const tmpl = templateHtml.replace(/\{\{qr_code\}\}/g, qrPlaceholder)
  const body = renderInvoice(tmpl, invoiceData)

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

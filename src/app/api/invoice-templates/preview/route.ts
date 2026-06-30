import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderInvoice, DEFAULT_INVOICE_HTML, InvoiceData } from '@/lib/invoice/template'
import { getBranding } from '@/lib/branding'

const MOCK_DATA: InvoiceData = {
  praxis_name:     'Psychotherapiepraxis Musterfrau',
  praxis_slogan:   'Ihr Weg zu mehr Wohlbefinden',
  praxis_address:  'Musterstraße 1, 1010 Wien',
  praxis_email:    'praxis@musterfrau.at',
  praxis_phone:    '+43 1 234 5678',
  logo_base64:     '',
  logo_mime:       '',
  primary_color:   '#4f46e5',
  reference_number:'RE-2026-0042',
  transaction_date:'29.06.2026',
  due_date:        '13.07.2026',
  payer_name:      'Max Mustermann',
  payer_address:   'Patientengasse 7, 8010 Graz',
  amount_net:      '400,00',
  vat_rate:        '0',
  vat_amount:      '0,00',
  amount_gross:    '400,00',
  is_paid:         false,
  vat_enabled:     false,
  payment_info:    'IBAN: AT12 3456 7890 1234 5678 · BIC: MUSTBICXX · Musterbank AG',
  notes:           '',
  line_items: [
    { date: '03.06.2026', description: 'Psychotherapeutische Behandlung', service_label: 'Psychotherapeutische Behandlung', quantity: '1', unit_price_net: '100,00', amount_net: '100,00' },
    { date: '10.06.2026', description: 'Psychotherapeutische Behandlung', service_label: 'Psychotherapeutische Behandlung', quantity: '1', unit_price_net: '100,00', amount_net: '100,00' },
    { date: '17.06.2026', description: 'Psychotherapeutische Behandlung', service_label: 'Psychotherapeutische Behandlung', quantity: '1', unit_price_net: '100,00', amount_net: '100,00' },
    { date: '24.06.2026', description: 'Psychotherapeutische Behandlung', service_label: 'Psychotherapeutische Behandlung', quantity: '1', unit_price_net: '100,00', amount_net: '100,00' },
  ],
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { htmlContent, guiFields, useReal, transactionId, templateId } = body

  // Wenn kein htmlContent mitgeliefert: aus DB laden
  let resolvedHtml = htmlContent
  if (!resolvedHtml && templateId) {
    const tmpl = await prisma.invoiceTemplate.findUnique({ where: { id: templateId } })
    if (tmpl) resolvedHtml = tmpl.customHtml ? tmpl.htmlContent : DEFAULT_INVOICE_HTML
  }
  if (!resolvedHtml) resolvedHtml = DEFAULT_INVOICE_HTML

  const branding = await getBranding()

  let data: InvoiceData = { ...MOCK_DATA }

  // GUI-Felder überschreiben Branding-Defaults
  const color = guiFields?.primaryColor || branding.colorPrimary || '#4f46e5'
  data.primary_color   = color
  data.praxis_name     = guiFields?.praxisName     || branding.praxisName
  data.praxis_slogan   = branding.slogan           || ''
  data.praxis_address  = guiFields?.praxisAddress  || branding.address || ''
  data.praxis_email    = guiFields?.praxisEmail    || branding.contactEmail || ''
  data.praxis_phone    = guiFields?.praxisPhone    || branding.contactPhone || ''
  data.logo_base64     = branding.logoBase64       || ''
  data.logo_mime       = branding.logoMimeType     || ''

  const paymentDays = guiFields?.paymentDays ?? 14
  const iban        = guiFields?.iban   || ''
  const bic         = guiFields?.bic    || ''
  const bankName    = guiFields?.bankName || ''
  const taxNumber   = guiFields?.taxNumber || ''
  const vatId       = guiFields?.vatId   || ''
  const footerText  = guiFields?.footerText || ''
  const invoiceTitle = guiFields?.invoiceTitle || 'Honorarnote'

  if (iban) {
    data.payment_info = `IBAN: ${iban}${bic ? ` · BIC: ${bic}` : ''}${bankName ? ` · ${bankName}` : ''}`
  }

  // Bild-Felder
  const bgOpacity = (guiFields?.bgImageOpacity ?? 0.08).toFixed(2)
  const bgMode    = guiFields?.bgImageMode ?? 'behind'
  data.header_image_base64 = guiFields?.headerImageBase64 ?? ''
  data.header_image_mime   = guiFields?.headerImageMime   ?? 'image/png'
  data.footer_image_base64 = guiFields?.footerImageBase64 ?? ''
  data.footer_image_mime   = guiFields?.footerImageMime   ?? 'image/png'
  data.bg_image_base64     = guiFields?.bgImageBase64     ?? ''
  data.bg_image_mime       = guiFields?.bgImageMime       ?? 'image/png'
  data.bg_image_opacity    = bgOpacity
  data.bg_is_watermark     = bgMode === 'watermark'

  // Echte Transaktion laden
  if (useReal && transactionId) {
    try {
      const tx = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
          patient: { select: { firstName: true, lastName: true } },
        },
      })
      if (tx) {
        const fmtEUR = (n: any) => parseFloat(n?.toString() ?? '0').toFixed(2).replace('.', ',')
        const fmtDate = (d: Date) => d.toLocaleDateString('de-AT')
        data = {
          ...data,
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
      }
    } catch { /* Fallback auf Musterdaten */ }
  } else {
    // Musterdaten: due_date aus paymentDays berechnen
    data.due_date = new Date(Date.now() + paymentDays * 24 * 3600000).toLocaleDateString('de-AT')
  }

  // QR-Code: EPC-QR für SEPA (als Data-URL, simpel als Text-Platzhalter)
  const qrPlaceholder = guiFields?.showQrCode && iban
    ? `<div style="margin-top:8px;padding:8px;border:1px solid #ddd;border-radius:6px;display:inline-block;font-size:9pt;color:#666;text-align:center">
        <div style="width:80px;height:80px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;margin:0 auto 4px;font-size:8pt;color:#999">QR-Code<br>SEPA</div>
        IBAN: ${iban}
       </div>`
    : ''

  // Template zusammenbauen
  let template = resolvedHtml

  // GUI-Felder in Template injizieren (zusätzliche Platzhalter)
  template = template
    .replace(/\{\{invoice_title\}\}/g, invoiceTitle)
    .replace(/\{\{tax_number\}\}/g, taxNumber)
    .replace(/\{\{vat_id\}\}/g, vatId)
    .replace(/\{\{footer_text\}\}/g, footerText)
    .replace(/\{\{qr_code\}\}/g, qrPlaceholder)

  const html = renderInvoice(template, data)

  return NextResponse.json({ html })
}

// Letzte echte Transaktion für Vorschau-Auswahl
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tx = await prisma.transaction.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, referenceNumber: true, transactionDate: true, payerName: true, amountGross: true },
  })
  return NextResponse.json({ transaction: tx })
}

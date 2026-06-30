
import { prisma } from '@/lib/prisma'

export const DEFAULT_INVOICE_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; }
  .page { max-width: 210mm; margin: 0 auto; padding: 20mm 20mm 15mm 20mm; min-height: 289mm; display: flex; flex-direction: column; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; padding-bottom: 6mm; border-bottom: 2px solid {{primary_color}}; }
  .logo-area h1 { font-size: 18pt; font-weight: 700; color: {{primary_color}}; }
  .logo-area p { font-size: 9pt; color: #666; margin-top: 2px; }
  .praxis-info { text-align: right; font-size: 9pt; color: #444; line-height: 1.6; }

  /* Empfänger & Rechnungsinfo */
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 8mm; }
  .recipient h3 { font-size: 9pt; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .recipient p { font-size: 10.5pt; line-height: 1.6; }
  .invoice-info { text-align: right; }
  .invoice-info table { border-collapse: collapse; }
  .invoice-info td { padding: 2px 6px; font-size: 10pt; }
  .invoice-info td:first-child { color: #666; text-align: left; }
  .invoice-info td:last-child { font-weight: 600; text-align: right; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 9pt; font-weight: 600; }


  /* Titel */
  .invoice-title { font-size: 16pt; font-weight: 700; color: #1a1a2e; margin-bottom: 6mm; }

  /* Tabelle */
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
  .items-table thead tr { background: {{primary_color}}; color: #fff; }
  .items-table thead th { padding: 8px 10px; text-align: left; font-size: 9.5pt; font-weight: 600; }
  .items-table thead th:last-child { text-align: right; }
  .items-table tbody tr { border-bottom: 0.5px solid #e5e7eb; }
  .items-table tbody tr:nth-child(even) { background: #f9fafb; }
  .items-table tbody td { padding: 7px 10px; font-size: 10pt; vertical-align: top; }
  .items-table tbody td:last-child { text-align: right; font-weight: 500; }
  .items-table .date-col { color: #666; font-size: 9pt; }
  .items-table .desc-col { }
  .items-table .qty-col { text-align: center; }
  .items-table .price-col { text-align: right; }
  .items-table .total-col { text-align: right; font-weight: 600; }

  /* Summen */
  .totals { display: flex; justify-content: flex-end; margin-bottom: 8mm; }
  .totals-box { min-width: 200px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 10.5pt; border-bottom: 0.5px solid #e5e7eb; }
  .totals-row:last-child { border-bottom: 2px solid {{primary_color}}; padding-top: 6px; margin-top: 2px; }
  .totals-row.total { font-size: 12pt; font-weight: 700; color: {{primary_color}}; }
  .totals-label { color: #666; }
  .totals-value { font-weight: 500; min-width: 80px; text-align: right; }

  /* Zahlungshinweis */
  .payment-box { background: #f0f4ff; border-left: 3px solid {{primary_color}}; padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 8mm; font-size: 9.5pt; line-height: 1.7; }
  .payment-box strong { color: {{primary_color}}; }

  /* Footer */
  .footer { border-top: 0.5px solid #e5e7eb; padding-top: 5mm; display: flex; justify-content: space-between; font-size: 8.5pt; color: #888; }
  .footer a { color: {{primary_color}}; text-decoration: none; }

  /* Hintergrundbild — bleedet wie Header/Footer-Bilder bis zum Seitenrand,
     der eigentliche Inhalt bekommt sein eigenes Padding zurück */
  .bg-layer-wrapper {
    position: relative;
    margin: 0 -20mm;
    flex: 1;
  }
  .page-content {
    position: relative;
    z-index: 1;
    padding: 0 20mm;
  }
  {{#if bg_image_base64}}
  .bg-layer {
    position: absolute;
    left: 0; right: 0;
    top: 0; bottom: 0;
    background-image: url(data:{{bg_image_mime}};base64,{{bg_image_base64}});
    background-size: cover; background-position: center;
    opacity: {{bg_image_opacity}};
    {{#if bg_is_watermark}}z-index: 100; pointer-events: none;{{else}}z-index: 0;{{/if}}
  }
  .page {
    position: relative;
  }
  {{/if}}
</style>
</head>
<body>
<div class="page">
  {{#if header_image_base64}}
  <div style="margin: -20mm -20mm 0 -20mm; line-height: 0; flex-shrink: 0;">
    <img src="data:{{header_image_mime}};base64,{{header_image_base64}}" style="width: 100%; display: block; max-height: 50mm; object-fit: cover;" alt="">
  </div>
  {{/if}}

  <div class="bg-layer-wrapper">
  {{#if bg_image_base64}}<div class="bg-layer"></div>{{/if}}
  <div class="page-content" style="{{#if header_image_base64}}padding-top:8mm;{{/if}}{{#if footer_image_base64}}padding-bottom:8mm;{{/if}}">

  <div class="header" {{#if header_image_base64}}style="border-top: none;"{{/if}}>
    <div class="logo-area">
      {{#if logo_base64}}<img src="data:{{logo_mime}};base64,{{logo_base64}}" style="height:50px;margin-bottom:6px;display:block;" alt="Logo">{{/if}}
      <h1>{{praxis_name}}</h1>
      <p>{{praxis_slogan}}</p>
    </div>
    <div class="praxis-info">
      <strong>{{praxis_name}}</strong><br>
      {{praxis_address}}<br>
      {{praxis_email}}<br>
      {{praxis_phone}}
    </div>
  </div>

  <div class="meta-row">
    <div class="recipient">
      <h3>Rechnung an</h3>
      <p>
        <strong>{{payer_name}}</strong><br>
        {{payer_address}}
      </p>
    </div>
    <div class="invoice-info">
      <table>
        <tr><td>Rechnungsnummer</td><td><strong>{{reference_number}}</strong></td></tr>
        <tr><td>Rechnungsdatum</td><td>{{transaction_date}}</td></tr>
        <tr><td>Fällig bis</td><td>{{due_date}}</td></tr>

      </table>
    </div>
  </div>

  <div class="invoice-title">{{invoice_title}}</div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:90px">Datum</th>
        <th>Beschreibung</th>
        <th style="width:60px;text-align:center">Anz.</th>
        <th style="width:90px;text-align:right">Einzel €</th>
        <th style="width:90px;text-align:right">Gesamt €</th>
      </tr>
    </thead>
    <tbody>
      {{#each line_items}}
      <tr>
        <td class="date-col">{{this.date}}</td>
        <td class="desc-col">
          {{this.description}}
          {{#if this.service_label}}<br><small style="color:#666">{{this.service_label}}</small>{{/if}}
        </td>
        <td class="qty-col">{{this.quantity}}</td>
        <td class="price-col">{{this.unit_price_net}}</td>
        <td class="total-col">{{this.amount_net}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span class="totals-label">Nettobetrag</span>
        <span class="totals-value">€ {{amount_net}}</span>
      </div>
      {{#if vat_enabled}}
      <div class="totals-row">
        <span class="totals-label">MwSt. {{vat_rate}}%</span>
        <span class="totals-value">€ {{vat_amount}}</span>
      </div>
      {{/if}}
      <div class="totals-row total">
        <span>Gesamtbetrag</span>
        <span>€ {{amount_gross}}</span>
      </div>
    </div>
  </div>

  {{#if payment_info}}
  <div class="payment-box" style="display:flex; align-items:center; gap:14px; justify-content:space-between;">
    <div style="flex:1;">
      <strong>Zahlungshinweis:</strong><br>
      Bitte überweisen Sie den Betrag von <strong>€ {{amount_gross}}</strong> unter Angabe der Rechnungsnummer <strong>{{reference_number}}</strong> auf folgendes Konto:<br>
      {{payment_info}}
    </div>
    {{qr_code}}
  </div>
  {{/if}}

  {{#if notes}}
  <div style="font-size:9.5pt;color:#555;margin-bottom:6mm;padding:6px 10px;background:#f9fafb;border-radius:4px;">
    <strong>Anmerkungen:</strong> {{notes}}
  </div>
  {{/if}}

  </div><!-- /page-content -->
  </div><!-- /bg-layer-wrapper -->

  {{#if footer_image_base64}}
  <div style="margin: 0 -20mm -15mm -20mm; line-height: 0; flex-shrink: 0;">
    <img src="data:{{footer_image_mime}};base64,{{footer_image_base64}}" style="width: 100%; display: block; max-height: 40mm; object-fit: cover;" alt="">
  </div>
  {{else}}
  <div class="footer">
    <div>{{praxis_name}} · {{praxis_address}}</div>
    <div>{{praxis_email}} · {{praxis_phone}}</div>
  </div>
  {{/if}}

</div>
</body>
</html>`

// Platzhalter-Dokumentation
export const INVOICE_PLACEHOLDERS = {
  // Praxis
  '{{praxis_name}}':     'Name der Praxis',
  '{{praxis_slogan}}':   'Slogan/Untertitel',
  '{{praxis_address}}':  'Adresse der Praxis',
  '{{praxis_email}}':    'E-Mail der Praxis',
  '{{praxis_phone}}':    'Telefon der Praxis',
  '{{logo_base64}}':     'Logo als Base64 (automatisch)',
  '{{logo_mime}}':       'Logo MIME-Type (automatisch)',
  '{{primary_color}}':   'Primärfarbe (automatisch)',
  // Transaktion
  '{{reference_number}}': 'Referenznummer',
  '{{transaction_date}}': 'Rechnungsdatum',
  '{{due_date}}':         'Fälligkeitsdatum',
  '{{payer_name}}':       'Name des Zahlers',
  '{{payer_address}}':    'Adresse des Zahlers',
  '{{amount_net}}':       'Nettobetrag',
  '{{vat_rate}}':         'MwSt.-Satz in %',
  '{{vat_amount}}':       'MwSt.-Betrag',
  '{{amount_gross}}':     'Bruttobetrag',
  '{{is_paid}}':          'true wenn bezahlt',
  '{{payment_info}}':     'Zahlungsinformationen (IBAN etc.)',
  '{{notes}}':            'Notizen zur Transaktion',
  // Positionen
  '{{#each line_items}}': 'Schleife über Rechnungspositionen',
  '{{this.date}}':        'Datum der Position',
  '{{this.description}}': 'Beschreibung der Position',
  '{{this.service_label}}': 'Dienstleistungsbezeichnung',
  '{{this.quantity}}':    'Menge',
  '{{this.unit_price_net}}': 'Einzelpreis netto',
  '{{this.amount_net}}':  'Gesamtpreis netto',
}

export type InvoiceData = {
  praxis_name: string
  praxis_slogan: string
  praxis_address: string
  praxis_email: string
  praxis_phone: string
  logo_base64?: string
  logo_mime?: string
  primary_color: string
  reference_number: string
  transaction_date: string
  due_date: string
  payer_name: string
  payer_address: string
  amount_net: string
  vat_rate?: string
  vat_amount?: string
  amount_gross: string
  is_paid: boolean
  vat_enabled: boolean
  payment_info?: string
  notes?: string
  invoice_title?: string
  tax_number?: string
  vat_id?: string
  footer_text?: string
  header_image_base64?: string
  header_image_mime?: string
  footer_image_base64?: string
  footer_image_mime?: string
  bg_image_base64?: string
  bg_image_mime?: string
  bg_image_opacity?: string
  bg_is_watermark?: boolean
  line_items: Array<{
    date: string
    description: string
    service_label?: string
    quantity: string
    unit_price_net: string
    amount_net: string
  }>
}

export function renderInvoice(template: string, data: InvoiceData): string {
  let html = template

  // 1. Each loops ZUERST (damit innere {{#if this.X}} danach aufgelöst werden)
  html = html.replace(/\{\{#each line_items\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, itemTemplate) => {
    return data.line_items.map(item => {
      let row = itemTemplate
      // Innere {{#if this.X}}...{{/if}} auflösen
      row = row.replace(/\{\{#if this\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m: string, key: string, inner: string) => {
        return (item as any)[key] ? inner : ''
      })
      row = row.replace(/\{\{this\.date\}\}/g, item.date)
      row = row.replace(/\{\{this\.description\}\}/g, item.description)
      row = row.replace(/\{\{this\.service_label\}\}/g, item.service_label || '')
      row = row.replace(/\{\{this\.quantity\}\}/g, item.quantity)
      row = row.replace(/\{\{this\.unit_price_net\}\}/g, item.unit_price_net)
      row = row.replace(/\{\{this\.amount_net\}\}/g, item.amount_net)
      return row
    }).join('')
  })

  // 2. Outer {{#if key}}...{{else}}...{{/if}} mit optionalem {{else}}
  html = html.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_match: string, key: string, truePart: string, falsePart: string = '') => {
      const val = (data as any)[key]
      return (val && val !== 'false' && val !== '0') ? truePart : falsePart
    }
  )

  // Simple replacements
  const simpleKeys: (keyof InvoiceData)[] = [
    'praxis_name','praxis_slogan','praxis_address','praxis_email','praxis_phone',
    'logo_base64','logo_mime','primary_color','reference_number','transaction_date',
    'due_date','payer_name','payer_address','amount_net','vat_rate','vat_amount',
    'amount_gross','payment_info','notes',
    'invoice_title','tax_number','vat_id','footer_text',
    'header_image_base64','header_image_mime','footer_image_base64','footer_image_mime',
    'bg_image_base64','bg_image_mime','bg_image_opacity',
  ]
  for (const key of simpleKeys) {
    const val = String((data as any)[key] || '')
    // Replacement als Funktion übergeben — verhindert $-Sonderzeichen-Bug bei Base64
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => val)
  }

  return html
}

export async function getDefaultTemplate(templateId?: string | null): Promise<{ html: string; guiFields?: any }> {
  try {
    let template = templateId
      ? await prisma.invoiceTemplate.findFirst({ where: { id: templateId, isActive: true } })
        ?? await prisma.invoiceTemplate.findFirst({ where: { isDefault: true, isActive: true }, orderBy: { createdAt: 'desc' } })
      : await prisma.invoiceTemplate.findFirst({ where: { isDefault: true, isActive: true }, orderBy: { createdAt: 'desc' } })
    // Fallback: irgendeine aktive Vorlage nehmen wenn keine als Default gesetzt
    if (!template) {
      template = await prisma.invoiceTemplate.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      })
    }
    if (!template) return { html: DEFAULT_INVOICE_HTML }
    return {
      // GUI-Vorlagen (customHtml=false) bekommen immer das aktuelle Code-Layout,
      // damit Layout-Fixes sofort greifen statt an einem eingefrorenen Snapshot zu hängen.
      // Nur explizit im HTML-Editor angepasste Vorlagen behalten ihren eigenen htmlContent.
      html: template.customHtml ? template.htmlContent : DEFAULT_INVOICE_HTML,
      guiFields: {
        invoiceTitle:       template.invoiceTitle       ?? 'Honorarnote',
        primaryColor:       template.primaryColor       ?? '#4f46e5',
        paymentDays:        template.paymentDays        ?? 14,
        iban:               template.iban               ?? '',
        bic:                template.bic                ?? '',
        bankName:           template.bankName           ?? '',
        taxNumber:          template.taxNumber          ?? '',
        vatId:              template.vatId              ?? '',
        praxisName:         template.praxisName         ?? '',
        praxisAddress:      template.praxisAddress      ?? '',
        praxisPhone:        template.praxisPhone        ?? '',
        praxisEmail:        template.praxisEmail        ?? '',
        footerText:         template.footerText         ?? '',
        showQrCode:         template.showQrCode         ?? true,
        headerImageBase64:  template.headerImageBase64  ?? '',
        headerImageMime:    template.headerImageMime    ?? '',
        footerImageBase64:  template.footerImageBase64  ?? '',
        footerImageMime:    template.footerImageMime    ?? '',
        bgImageBase64:      template.bgImageBase64      ?? '',
        bgImageMime:        template.bgImageMime        ?? '',
        bgImageOpacity:     template.bgImageOpacity     ?? 0.08,
        bgImageMode:        template.bgImageMode        ?? 'behind',
        customHtml:         template.customHtml         ?? false,
      }
    }
  } catch {
    return { html: DEFAULT_INVOICE_HTML }
  }
}

// ── Rechnung für eine konkrete Transaktion live rendern ─────────────────────────
// Wird nur einmalig beim allerersten Anzeigen/Erstellen aufgerufen - das Ergebnis
// wird danach als unveränderliches Snapshot gespeichert. Zentral hier statt in
// einzelnen Routen, damit sowohl die API-Routen (Anzeigen/Drucken) als auch der
// Erstellungs-Service (sofortige Generierung) dieselbe Logik verwenden - keine
// doppelte Implementierung.
//
// Vorlagen-Priorität: 1. explizit bei der Erstellung gewählte Vorlage
// (Transaction.invoiceTemplateId), 2. Patient-Standardvorlage, 3. globale
// Standardvorlage.
export async function renderInvoiceHtmlForTransaction(transactionId: string): Promise<string> {
  const { generateEpcQrDataUrl, qrImageHtml } = await import('@/lib/invoice/qr')
  const { getBranding } = await import('@/lib/branding')

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      patient: { select: { firstName: true, lastName: true, defaultInvoiceTemplateId: true } },
    },
  })
  if (!tx) throw new Error('Transaktion nicht gefunden')

  const templateId = (tx as any).invoiceTemplateId ?? (tx.patient as any)?.defaultInvoiceTemplateId ?? null
  const branding = await getBranding()
  let { html: templateHtml, guiFields } = await getDefaultTemplate(templateId)
  if (!templateHtml || templateHtml.includes('badge-unpaid') || templateHtml.includes('badge-paid')) {
    templateHtml = DEFAULT_INVOICE_HTML
  }
  const fmtEUR = (n: any) => parseFloat(n?.toString() ?? '0').toFixed(2).replace('.', ',')
  const fmtDate = (d: Date) => d.toLocaleDateString('de-AT')

  const paymentDays = guiFields?.paymentDays ?? 14
  const iban     = guiFields?.iban     || branding.iban     || ''
  const bic      = guiFields?.bic      || branding.bic      || ''
  const bankName = guiFields?.bankName || branding.bankName || ''
  const paymentInfo = iban
    ? `IBAN: ${iban}${bic ? ` · BIC: ${bic}` : ''}${bankName ? ` · ${bankName}` : ''}`
    : ''
  const bgOpacity = ((guiFields?.bgImageOpacity ?? 0.08) as number).toFixed(2)
  const bgMode    = guiFields?.bgImageMode ?? 'behind'
  const praxisNameForQr = guiFields?.praxisName || branding.praxisName
  let qrPlaceholder = ''
  if (guiFields?.showQrCode && iban) {
    const dataUrl = await generateEpcQrDataUrl({
      iban, bic, beneficiaryName: praxisNameForQr,
      amount: parseFloat(tx.amountGross.toString()), reference: tx.referenceNumber,
    })
    if (dataUrl) qrPlaceholder = qrImageHtml(dataUrl)
  }

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
    line_items: tx.lineItems.map((li: any) => ({
      date:           li.lineDate ? fmtDate(li.lineDate) : '',
      description:    li.description,
      service_label:  li.serviceLabel ?? '',
      quantity:       parseFloat(li.quantity.toString()).toString(),
      unit_price_net: fmtEUR(li.unitPriceNet),
      amount_net:     fmtEUR(li.amountNet),
    })),
  }

  const tmpl = templateHtml.replace(/\{\{qr_code\}\}/g, qrPlaceholder)
  return renderInvoice(tmpl, invoiceData)
}


import { prisma } from '@/lib/prisma'

export const DEFAULT_INVOICE_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; }
  .page { max-width: 210mm; margin: 0 auto; padding: 20mm 20mm 15mm 20mm; }

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
  .badge-paid { background: #dcfce7; color: #166534; }
  .badge-unpaid { background: #fef3c7; color: #92400e; }

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
</style>
</head>
<body>
<div class="page">

  <div class="header">
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
        <tr><td>Status</td><td>
          {{#if is_paid}}<span class="badge badge-paid">✓ Bezahlt</span>{{else}}<span class="badge badge-unpaid">Offen</span>{{/if}}
        </td></tr>
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
  <div class="payment-box">
    <strong>Zahlungshinweis:</strong><br>
    Bitte überweisen Sie den Betrag von <strong>€ {{amount_gross}}</strong> unter Angabe der Rechnungsnummer <strong>{{reference_number}}</strong> auf folgendes Konto:<br>
    {{payment_info}}
  </div>
  {{/if}}

  {{#if notes}}
  <div style="font-size:9.5pt;color:#555;margin-bottom:6mm;padding:6px 10px;background:#f9fafb;border-radius:4px;">
    <strong>Anmerkungen:</strong> {{notes}}
  </div>
  {{/if}}

  <div class="footer">
    <div>{{praxis_name}} · {{praxis_address}}</div>
    <div>{{praxis_email}} · {{praxis_phone}}</div>
  </div>

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

  // Simple if blocks
  html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, content) => {
    return (data as any)[key] ? content : ''
  })

  // Each loops for line_items
  html = html.replace(/\{\{#each line_items\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, itemTemplate) => {
    return data.line_items.map(item => {
      let row = itemTemplate
      row = row.replace(/\{\{this\.date\}\}/g, item.date)
      row = row.replace(/\{\{this\.description\}\}/g, item.description)
      row = row.replace(/\{\{this\.service_label\}\}/g, item.service_label || '')
      row = row.replace(/\{\{this\.quantity\}\}/g, item.quantity)
      row = row.replace(/\{\{this\.unit_price_net\}\}/g, item.unit_price_net)
      row = row.replace(/\{\{this\.amount_net\}\}/g, item.amount_net)
      return row
    }).join('')
  })

  // Simple replacements
  const simpleKeys: (keyof InvoiceData)[] = [
    'praxis_name','praxis_slogan','praxis_address','praxis_email','praxis_phone',
    'logo_base64','logo_mime','primary_color','reference_number','transaction_date',
    'due_date','payer_name','payer_address','amount_net','vat_rate','vat_amount',
    'amount_gross','payment_info','notes',
    'invoice_title','tax_number','vat_id','footer_text',
  ]
  for (const key of simpleKeys) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String((data as any)[key] || ''))
  }

  return html
}

export async function getDefaultTemplate(): Promise<{ html: string; guiFields?: any }> {
  try {
    const template = await prisma.invoiceTemplate.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!template) return { html: DEFAULT_INVOICE_HTML }
    return {
      html: template.htmlContent,
      guiFields: {
        invoiceTitle:  template.invoiceTitle  ?? 'Honorarnote',
        primaryColor:  template.primaryColor  ?? '#4f46e5',
        paymentDays:   template.paymentDays   ?? 14,
        iban:          template.iban          ?? '',
        bic:           template.bic           ?? '',
        bankName:      template.bankName      ?? '',
        taxNumber:     template.taxNumber     ?? '',
        vatId:         template.vatId         ?? '',
        praxisName:    template.praxisName    ?? '',
        praxisAddress: template.praxisAddress ?? '',
        praxisPhone:   template.praxisPhone   ?? '',
        praxisEmail:   template.praxisEmail   ?? '',
        footerText:    template.footerText    ?? '',
        showQrCode:    template.showQrCode    ?? true,
      }
    }
  } catch {
    return { html: DEFAULT_INVOICE_HTML }
  }
}

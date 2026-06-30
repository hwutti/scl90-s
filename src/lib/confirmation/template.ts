import { prisma } from '@/lib/prisma'

export const DEFAULT_CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>{{titel}}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: {{font_family}};
    font-size: {{font_size}};
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
  }
  .page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 20mm 20mm 25mm 20mm;
    min-height: 289mm;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  @media print {
    @page { size: A4; margin: 0; }
    body { padding: 0; }
    .page { padding: 20mm 20mm 25mm 20mm; max-width: none; }
    .no-print { display: none !important; }
  }

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
  {{/if}}

  .letterhead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8mm;
    border-bottom: 2px solid {{primary_color}};
    padding-bottom: 4mm;
  }
  .letterhead-left h1 { font-size: 13pt; font-weight: bold; color: {{primary_color}}; margin-bottom: 2mm; }
  .letterhead-left p { font-size: 9pt; color: #444; line-height: 1.4; }
  .letterhead-right { text-align: right; font-size: 9pt; color: #444; line-height: 1.5; }

  .doc-title {
    font-size: 14pt; font-weight: bold; color: {{primary_color}};
    margin: 6mm 0 6mm; border-bottom: 1.5px solid {{primary_color}}; padding-bottom: 2mm;
  }

  .body-text { font-size: 11pt; line-height: 1.9; white-space: pre-wrap; margin-bottom: 10mm; }

  .signature { margin-top: 18mm; }
  .signature .sig-line { border-top: 1px solid #1a1a1a; width: 70mm; margin-top: 14mm; padding-top: 1mm; font-size: 9pt; color: #444; }

  .page-footer {
    margin-top: 8mm; padding-top: 3mm;
    border-top: 0.5px solid #ccc;
    font-size: 8pt; color: #888;
    display: flex; justify-content: space-between;
  }

  .no-print {
    position: fixed; top: 12px; right: 12px; z-index: 9999;
    display: flex; gap: 8px;
  }
  .no-print button {
    padding: 8px 18px; border: none; border-radius: 8px;
    cursor: pointer; font-size: 13px; font-family: sans-serif;
  }
  .btn-print { background: {{primary_color}}; color: #fff; }
  .btn-close { background: #e5e7eb; color: #374151; }
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨 Drucken / Als PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Schließen</button>
</div>

<div class="page">
  {{#if header_image_base64}}
  <div style="margin: -20mm -20mm 0 -20mm; line-height: 0; flex-shrink: 0;">
    <img src="data:{{header_image_mime}};base64,{{header_image_base64}}"
      style="width:100%;display:block;max-height:45mm;object-fit:cover;" alt="">
  </div>
  {{/if}}

  <div class="bg-layer-wrapper">
  {{#if bg_image_base64}}<div class="bg-layer"></div>{{/if}}
  <div class="page-content" style="{{#if header_image_base64}}padding-top:6mm;{{/if}}{{#if footer_image_base64}}padding-bottom:8mm;{{/if}}">

  <div class="letterhead" {{#if header_image_base64}}style="border-top:none;"{{/if}}>
    <div class="letterhead-left">
      <h1>{{praxis_name}}</h1>
      {{#if praxis_address}}<p>{{praxis_address}}</p>{{/if}}
      {{#if praxis_email}}<p>{{praxis_email}}</p>{{/if}}
      {{#if praxis_phone}}<p>{{praxis_phone}}</p>{{/if}}
    </div>
    <div class="letterhead-right">
      <p><strong>{{heutiges_datum}}</strong></p>
      {{#if therapeut_name}}<p>{{therapeut_name}}</p>{{/if}}
      {{#if tax_number}}<p>StNr: {{tax_number}}</p>{{/if}}
      {{#if vat_id}}<p>UID: {{vat_id}}</p>{{/if}}
    </div>
  </div>

  <div class="doc-title">{{titel}}</div>

  <div class="body-text">{{freitext}}</div>

  <div class="signature">
    <p>Mit freundlichen Grüßen,</p>
    <div class="sig-line">{{therapeut_name}}<br>{{praxis_name}}</div>
  </div>

  </div><!-- /page-content -->
  </div><!-- /bg-layer-wrapper -->

  {{#if footer_image_base64}}
  <div style="margin: 0 -20mm -25mm -20mm; line-height: 0; flex-shrink: 0;">
    <img src="data:{{footer_image_mime}};base64,{{footer_image_base64}}"
      style="width:100%;display:block;max-height:35mm;object-fit:cover;" alt="">
  </div>
  {{else}}
  <div class="page-footer">
    <span>{{praxis_name}}{{#if praxis_address}} · {{praxis_address}}{{/if}}</span>
    <span>{{footer_text}}</span>
  </div>
  {{/if}}

</div>
</body>
</html>`

// ── Platzhalter-Dokumentation (Aufgabe 6) ──────────────────────────────────────
export const CONFIRMATION_PLACEHOLDERS = {
  // Patient
  '{{patient_name}}':         'Vollständiger Name des Patienten',
  '{{patient_vorname}}':      'Vorname',
  '{{patient_nachname}}':     'Nachname',
  '{{patient_geburtsdatum}}': 'Geburtsdatum',
  '{{patient_adresse}}':      'Adresse des Patienten',
  // Therapeut
  '{{therapeut_name}}':       'Name des/der behandelnden Therapeut*in',
  '{{praxis}}':                'Praxisname',
  '{{praxis_adresse}}':       'Praxisadresse',
  '{{email}}':                 'Praxis-E-Mail',
  '{{telefon}}':                'Praxis-Telefon',
  // Sitzung
  '{{sitzungsdatum}}':        'Datum der ausgewählten Sitzung',
  '{{uhrzeit}}':                'Uhrzeit der Sitzung',
  '{{dauer}}':                  'Dauer der Sitzung in Minuten',
  // Dokument
  '{{heutiges_datum}}':       'Heutiges Datum',
  '{{titel}}':                 'Titel der Bestätigung',
  '{{freitext}}':              'Freitext-Inhalt der Bestätigung',
}

// Einfache, rein textuelle Platzhalter-Auflösung (kein {{#if}}) - wird für den
// Freitext-Inhalt verwendet, BEVOR dieser in das Seiten-Layout eingesetzt wird.
export function resolveTextPlaceholders(text: string, data: Record<string, any>): string {
  let out = text ?? ''
  for (const [key, value] of Object.entries(data)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => String(value ?? ''))
  }
  return out
}

// ── Template-Rendering (Seiten-Layout) ──────────────────────────────────────────
export function renderConfirmation(template: string, data: Record<string, any>): string {
  let html = template

  // 1. {{#if key}}...{{else}}...{{/if}}
  html = html.replace(
    /\{\{#if ([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_match, key, truePart, falsePart = '') => {
      const val = data[key]
      return (val && val !== 'false' && val !== '0' && val !== '') ? truePart : falsePart
    }
  )

  // 2. Einfache Platzhalter
  for (const [key, value] of Object.entries(data)) {
    const val = String(value ?? '')
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => val)
  }

  return html
}

// Baut die Platzhalter-Werte (Patient/Therapeut/Sitzung/Dokument) für eine
// konkrete Bestätigung. {{freitext}} ist bewusst NICHT enthalten - der
// aufgelöste Freitext wird separat ergänzt (siehe resolveTextPlaceholders).
export function buildConfirmationPlaceholders(params: {
  patient: { firstName: string; lastName: string; dob: string; billRecipientAddress?: string | null; billRecipientCity?: string | null }
  therapistName: string
  praxisName: string
  praxisAddress: string
  praxisEmail: string
  praxisPhone: string
  session?: { sessionDate: Date; durationMinutes?: number | null } | null
  titel: string
}): Record<string, string> {
  const fmtDate = (d: string | Date) => {
    const dt = typeof d === 'string' ? new Date(d) : d
    return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('de-AT')
  }
  const fmtTime = (d: Date) => d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })

  const patientAdresse = [params.patient.billRecipientAddress, params.patient.billRecipientCity]
    .filter(Boolean).join(', ')

  return {
    patient_name:         `${params.patient.firstName} ${params.patient.lastName}`,
    patient_vorname:      params.patient.firstName,
    patient_nachname:     params.patient.lastName,
    patient_geburtsdatum: fmtDate(params.patient.dob),
    patient_adresse:      patientAdresse,
    therapeut_name:       params.therapistName,
    praxis:               params.praxisName,
    praxis_adresse:       params.praxisAddress,
    email:                params.praxisEmail,
    telefon:              params.praxisPhone,
    sitzungsdatum:        params.session ? fmtDate(params.session.sessionDate) : '',
    uhrzeit:               params.session ? fmtTime(params.session.sessionDate) : '',
    dauer:                 params.session?.durationMinutes ? `${params.session.durationMinutes} min` : '',
    heutiges_datum:       new Date().toLocaleDateString('de-AT', { dateStyle: 'long' }),
    titel:                 params.titel,
  }
}

export async function getDefaultConfirmationTemplate(
  templateId?: string | null
): Promise<{ html: string; bodyText: string; guiFields: any }> {
  try {
    let template = templateId
      ? await prisma.confirmationTemplate.findFirst({ where: { id: templateId, isActive: true } })
      : null
    if (!template) {
      template = await prisma.confirmationTemplate.findFirst({
        where: { isDefault: true, isActive: true }, orderBy: { createdAt: 'desc' },
      })
    }
    if (!template) {
      template = await prisma.confirmationTemplate.findFirst({
        where: { isActive: true }, orderBy: { createdAt: 'asc' },
      })
    }
    if (!template) return { html: DEFAULT_CONFIRMATION_HTML, bodyText: '', guiFields: {} }

    return {
      // GUI-Vorlagen (customHtml=false) bekommen immer das aktuelle Code-Layout.
      html: template.customHtml ? template.htmlContent : DEFAULT_CONFIRMATION_HTML,
      bodyText: template.bodyText ?? '',
      guiFields: {
        primaryColor:      template.primaryColor      ?? '#4f46e5',
        fontFamily:        template.fontFamily        ?? 'Helvetica Neue, Arial, sans-serif',
        fontSize:          template.fontSize          ?? '11pt',
        praxisName:        template.praxisName        ?? '',
        praxisAddress:     template.praxisAddress     ?? '',
        praxisPhone:       template.praxisPhone       ?? '',
        praxisEmail:       template.praxisEmail       ?? '',
        taxNumber:         template.taxNumber         ?? '',
        vatId:             template.vatId             ?? '',
        footerText:        template.footerText        ?? '',
        headerImageBase64: template.headerImageBase64 ?? '',
        headerImageMime:   template.headerImageMime   ?? 'image/png',
        footerImageBase64: template.footerImageBase64 ?? '',
        footerImageMime:   template.footerImageMime   ?? 'image/png',
        bgImageBase64:     template.bgImageBase64     ?? '',
        bgImageMime:       template.bgImageMime       ?? 'image/png',
        bgImageOpacity:    template.bgImageOpacity    ?? 0.06,
        bgImageMode:       template.bgImageMode       ?? 'behind',
        customHtml:        template.customHtml        ?? false,
      },
    }
  } catch {
    return { html: DEFAULT_CONFIRMATION_HTML, bodyText: '', guiFields: {} }
  }
}

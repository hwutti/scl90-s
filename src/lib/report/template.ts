import { prisma } from '@/lib/prisma'

// ── Platzhalter-Referenz ──────────────────────────────────────────────────────
// {{praxis_name}}        Praxisname
// {{praxis_address}}     Adresse
// {{praxis_email}}       E-Mail
// {{praxis_phone}}       Telefon
// {{primary_color}}      Hauptfarbe (Hex)
// {{font_family}}        Schriftart
// {{font_size}}          Schriftgröße
// {{header_image_...}}   Briefkopf-Bild
// {{footer_image_...}}   Fußzeilen-Bild
// {{bg_image_...}}       Hintergrundbild
// {{footer_text}}        Fußzeile
// {{report_title}}       Berichtstitel
// {{today}}              Aktuelles Datum
// {{patient_name}}       Patientenname
// {{patient_dob}}        Geburtsdatum
// {{therapist_name}}     Therapeutenname
// {{content}}            Hauptinhalt (wird von Bericht-Route gefüllt)

export const DEFAULT_REPORT_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>{{report_title}}</title>
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
    min-height: 297mm;
    position: relative;
  }
  @media print {
    @page { size: A4; margin: 0; }
    body { padding: 0; }
    .page { padding: 20mm 20mm 25mm 20mm; max-width: none; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
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
  .bg-layer-wrapper { position: relative; }
  .page-content { position: relative; z-index: 1; }
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

  .adress-block { margin-bottom: 6mm; }
  .adress-block .label { font-size: 8pt; color: #999; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1mm; }

  .report-title { font-size: 13pt; font-weight: bold; color: {{primary_color}}; margin: 6mm 0 4mm; border-bottom: 1.5px solid {{primary_color}}; padding-bottom: 2mm; }

  .meta-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 4mm; margin-bottom: 6mm; background: #f8f8f8; padding: 4mm; border-radius: 4px; }
  .meta-item .label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta-item .value { font-size: 10pt; font-weight: 600; }

  .section { margin-bottom: 6mm; }
  .section h2 { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 0.5px solid #bbb; padding-bottom: 1mm; margin-bottom: 3mm; color: #333; }
  .section p { font-size: 10.5pt; margin-bottom: 2mm; }
  .section .empty { color: #bbb; font-style: italic; font-size: 10pt; }

  .diag-list { list-style: none; }
  .diag-list li { padding: 1.5mm 0; border-bottom: 0.5px solid #eee; display: flex; gap: 4mm; font-size: 10.5pt; }
  .diag-list li .icd { font-family: monospace; font-size: 10pt; color: #555; min-width: 18mm; }
  .diag-list li .type { font-size: 9pt; color: #888; margin-left: auto; white-space: nowrap; }

  .session-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 2mm; }
  .session-table th { background: #f0f0f0; padding: 2mm 3mm; text-align: left; font-weight: 600; border: 0.5px solid #ccc; }
  .session-table td { padding: 2mm 3mm; border: 0.5px solid #ddd; vertical-align: top; }
  .session-table tr:nth-child(even) td { background: #fafafa; }

  .assessment-box { border: 0.5px solid #ddd; border-radius: 4px; padding: 3mm; margin-bottom: 3mm; }
  .assessment-box .name { font-weight: 600; font-size: 10pt; color: {{primary_color}}; }
  .assessment-box .summary { font-size: 9pt; color: #555; margin-top: 1mm; font-style: italic; }
  .clinical-flag { color: #c0392b; font-size: 9.5pt; font-weight: 600; }

  .data-protection {
    margin-top: 6mm; padding: 3mm 4mm;
    background: #f9f9f9; border: 0.5px solid #ddd;
    font-size: 8.5pt; color: #666; border-radius: 4px;
  }

  .signature { margin-top: 14mm; }
  .signature .sig-line { border-top: 1px solid #1a1a1a; width: 70mm; margin-top: 12mm; padding-top: 1mm; font-size: 9pt; color: #444; }

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
  <div style="margin: -20mm -20mm 0 -20mm; line-height: 0;">
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
      <p><strong>{{today}}</strong></p>
      {{#if therapist_name}}<p>{{therapist_name}}</p>{{/if}}
      {{#if tax_number}}<p>StNr: {{tax_number}}</p>{{/if}}
      {{#if vat_id}}<p>UID: {{vat_id}}</p>{{/if}}
    </div>
  </div>

  {{content}}

  {{#if show_data_protection}}
  <div class="data-protection">
    <strong>Datenschutz gem. §16a Psychotherapiegesetz (AT):</strong>
    Dieser Bericht enthält vertrauliche Gesundheitsdaten und darf nur mit schriftlicher Einwilligung der Klient*in weitergegeben werden.
    Aufbewahrungspflicht: 10 Jahre nach Therapieende. Klient*innen haben Einsichts- und Kopierrecht.
  </div>
  {{/if}}

  <div class="signature">
    <p>Mit freundlichen Grüßen,</p>
    <div class="sig-line">{{therapist_name}}<br>{{praxis_name}}</div>
  </div>

  </div><!-- /page-content -->
  </div><!-- /bg-layer-wrapper -->

  {{#if footer_image_base64}}
  <div style="margin: 0 -20mm -25mm -20mm; line-height: 0;">
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

// ── Template-Rendering ────────────────────────────────────────────────────────

export function renderReportTemplate(template: string, data: Record<string, any>): string {
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

// ── DB: Standard-Vorlage laden ────────────────────────────────────────────────

export async function getDefaultReportTemplate(
  reportType: string,
  templateId?: string | null
): Promise<{ html: string; guiFields: any }> {
  try {
    let template = null

    // 1. Explizite templateId
    if (templateId) {
      template = await prisma.reportTemplate.findFirst({
        where: { id: templateId, isActive: true }
      })
    }

    // 2. Standard-Vorlage für den Typ
    if (!template) {
      template = await prisma.reportTemplate.findFirst({
        where: { isDefault: true, isActive: true, reportType: { in: [reportType, 'all'] } },
        orderBy: [{ reportType: 'desc' }, { createdAt: 'desc' }] // spezifischer Typ bevorzugt
      })
    }

    // 3. Irgendeine aktive Vorlage
    if (!template) {
      template = await prisma.reportTemplate.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      })
    }

    if (!template) return { html: DEFAULT_REPORT_HTML, guiFields: {} }

    return {
      // GUI-Vorlagen (customHtml=false) bekommen immer das aktuelle Code-Layout.
      html: template.customHtml ? (template.htmlContent || DEFAULT_REPORT_HTML) : DEFAULT_REPORT_HTML,
      guiFields: {
        primaryColor:     template.primaryColor     ?? '#1a1a2e',
        fontFamily:       template.fontFamily       ?? 'Times New Roman, serif',
        fontSize:         template.fontSize         ?? '11pt',
        praxisName:       template.praxisName       ?? '',
        praxisAddress:    template.praxisAddress    ?? '',
        praxisPhone:      template.praxisPhone      ?? '',
        praxisEmail:      template.praxisEmail      ?? '',
        taxNumber:        template.taxNumber        ?? '',
        vatId:            template.vatId            ?? '',
        footerText:       template.footerText       ?? '',
        showPageNumbers:  template.showPageNumbers  ?? true,
        showDataProtection: template.showDataProtection ?? true,
        headerImageBase64: template.headerImageBase64 ?? '',
        headerImageMime:   template.headerImageMime   ?? 'image/png',
        footerImageBase64: template.footerImageBase64 ?? '',
        footerImageMime:   template.footerImageMime   ?? 'image/png',
        bgImageBase64:     template.bgImageBase64     ?? '',
        bgImageMime:       template.bgImageMime       ?? 'image/png',
        bgImageOpacity:    template.bgImageOpacity    ?? 0.06,
        bgImageMode:       template.bgImageMode       ?? 'behind',
        customHtml:        template.customHtml        ?? false,
      }
    }
  } catch {
    return { html: DEFAULT_REPORT_HTML, guiFields: {} }
  }
}

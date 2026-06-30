import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderReportTemplate, DEFAULT_REPORT_HTML } from '@/lib/report/template'
import { getBranding } from '@/lib/branding'

const MOCK_CONTENT = `
  <div style="margin-bottom:6mm">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8mm;border-bottom:2px solid var(--pc,#1a1a2e);padding-bottom:4mm">
      <div><h1 style="font-size:13pt;font-weight:bold;color:var(--pc,#1a1a2e);margin-bottom:2mm">Psychotherapeutische Praxis Muster</h1>
        <p style="font-size:9pt;color:#444">Musterstraße 1, 1010 Wien</p>
        <p style="font-size:9pt;color:#444">praxis@muster.at · +43 1 234 5678</p></div>
      <div style="text-align:right;font-size:9pt;color:#444"><p><strong>29. Juni 2026</strong></p><p>Mag. Anna Muster</p></div>
    </div>

    <div style="font-size:13pt;font-weight:bold;color:var(--pc,#1a1a2e);margin:6mm 0 4mm;border-bottom:1.5px solid var(--pc,#1a1a2e);padding-bottom:2mm">Therapiebericht</div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-bottom:6mm;background:#f8f8f8;padding:4mm;border-radius:4px">
      <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Patient</div><div style="font-size:10pt;font-weight:600">Max Mustermann</div></div>
      <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Geburtsdatum</div><div style="font-size:10pt;font-weight:600">15.03.1985 (41 J.)</div></div>
      <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Zeitraum</div><div style="font-size:10pt;font-weight:600">Jan – Jun 2026</div></div>
      <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Sitzungen</div><div style="font-size:10pt;font-weight:600">24</div></div>
    </div>

    <div style="margin-bottom:5mm"><h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Diagnosen (ICD-10)</h2>
      <ul style="list-style:none"><li style="padding:1.5mm 0;border-bottom:.5px solid #eee;display:flex;gap:4mm;font-size:10.5pt">
        <span style="font-family:monospace;font-size:10pt;color:#555;min-width:18mm">F32.1</span>
        <span><strong>Mittelgradige depressive Episode</strong> <span style="font-size:9pt;color:#777">(Hauptdiagnose)</span></span>
      </li></ul></div>

    <div style="margin-bottom:5mm"><h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Behandlungsverlauf</h2>
      <p style="font-size:10.5pt">Der Patient stellte sich im Jänner 2026 mit einer mittelgradigen depressiven Episode vor. Im Verlauf der Behandlung konnten bedeutsame Fortschritte erzielt werden...</p></div>

    <div style="margin-top:6mm;padding:3mm 4mm;background:#f9f9f9;border:.5px solid #ddd;font-size:8.5pt;color:#666;border-radius:4px">
      <strong>Datenschutz gem. §16a PTG (AT):</strong> Dieser Bericht enthält vertrauliche Gesundheitsdaten.
    </div>

    <div style="margin-top:14mm"><p style="font-size:10.5pt">Mit freundlichen Grüßen,</p>
      <div style="border-top:1px solid #1a1a2e;width:70mm;margin-top:12mm;padding-top:1mm;font-size:9pt;color:#444">Mag. Anna Muster<br>Psychotherapeutische Praxis Muster</div></div>
  </div>
`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { htmlContent, templateId, guiFields, editorMode } = body

  // HTML aus DB laden wenn nötig
  let resolvedHtml = editorMode === 'html' ? htmlContent : null
  if (!resolvedHtml && templateId) {
    const tmpl = await prisma.reportTemplate.findUnique({ where: { id: templateId } })
    if (tmpl) resolvedHtml = tmpl.customHtml ? tmpl.htmlContent : DEFAULT_REPORT_HTML
  }
  if (!resolvedHtml) resolvedHtml = DEFAULT_REPORT_HTML

  const branding = await getBranding()

  const bgOpacity = ((guiFields?.bgImageOpacity ?? 0.06) as number).toFixed(2)
  const bgMode    = guiFields?.bgImageMode ?? 'behind'

  const data: Record<string, any> = {
    praxis_name:          guiFields?.praxisName    || branding.praxisName    || 'Psychotherapeutische Praxis',
    praxis_address:       guiFields?.praxisAddress || branding.address       || '',
    praxis_email:         guiFields?.praxisEmail   || branding.contactEmail  || '',
    praxis_phone:         guiFields?.praxisPhone   || branding.contactPhone  || '',
    primary_color:        guiFields?.primaryColor  || '#1a1a2e',
    font_family:          guiFields?.fontFamily    || 'Times New Roman, serif',
    font_size:            guiFields?.fontSize      || '11pt',
    tax_number:           guiFields?.taxNumber     || '',
    vat_id:               guiFields?.vatId         || '',
    footer_text:          guiFields?.footerText    || '',
    show_data_protection: guiFields?.showDataProtection !== false,
    report_title:         'Therapiebericht – Vorschau',
    today:                new Date().toLocaleDateString('de-AT', { dateStyle: 'long' }),
    therapist_name:       session.user?.name || '',
    patient_name:         'Max Mustermann',
    patient_dob:          '15.03.1985',
    header_image_base64:  guiFields?.headerImageBase64 || '',
    header_image_mime:    guiFields?.headerImageMime   || 'image/png',
    footer_image_base64:  guiFields?.footerImageBase64 || '',
    footer_image_mime:    guiFields?.footerImageMime   || 'image/png',
    bg_image_base64:      guiFields?.bgImageBase64     || '',
    bg_image_mime:        guiFields?.bgImageMime       || 'image/png',
    bg_image_opacity:     bgOpacity,
    bg_is_watermark:      bgMode === 'watermark',
    signature_image_base64: guiFields?.signatureImageBase64 ?? '',
    signature_image_mime:   guiFields?.signatureImageMime   ?? 'image/png',
    has_header_image:     !!(guiFields?.headerImageBase64),
    has_footer_image:     !!(guiFields?.footerImageBase64),
    content:              MOCK_CONTENT,
  }

  const html = renderReportTemplate(resolvedHtml, data)
  return NextResponse.json({ html })
}

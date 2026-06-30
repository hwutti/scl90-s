import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBranding } from '@/lib/branding'
import { getDefaultReportTemplate, renderReportTemplate } from '@/lib/report/template'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    reportType,        // 'therapiebericht' | 'arztbrief' | 'verlaufsbericht'
    adressat,          // Name des Empfängers
    adressatTitel,
    adressatAdresse,
    zeitraumVon,
    zeitraumBis,
    freitext,          // Freie Felder als Objekt
    includeSessions,   // boolean
    includeAssessments,
    includeGoals,
    includeAnamnese,
    anonymize,
  } = body

  const patient = await prisma.patient.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      diagnoses: { orderBy: [{ diagnosisType: 'asc' }, { diagnosedAt: 'asc' }] },
      anamnesis: { include: { sections: true } },
      therapySessions: {
        where: {
          ...(zeitraumVon && { sessionDate: { gte: new Date(zeitraumVon) } }),
          ...(zeitraumBis && { sessionDate: { lte: new Date(zeitraumBis) } }),
        },
        orderBy: [{ sessionDate: 'asc' }, { sessionNumber: 'asc' }],
        include: {
          protocols: {
            include: { sections: true }
          }
        }
      },
    }
  })
  if (!patient) return NextResponse.json({ error: 'Patient nicht gefunden' }, { status: 404 })

  // Assessments
  let assessments: any[] = []
  if (includeAssessments) {
    assessments = await prisma.assessment.findMany({
      where: {
        patientId: params.id,
        completedAt: { not: null },
        ...(zeitraumVon && { completedAt: { gte: new Date(zeitraumVon) } }),
        ...(zeitraumBis && { completedAt: { lte: new Date(zeitraumBis) } }),
      },
      include: { result: true, instrument: { select: { name: true, shortName: true } } },
      orderBy: { completedAt: 'asc' },
    })
  }

  // Therapieziele
  let goals: any[] = []
  if (includeGoals) {
    goals = await prisma.therapyGoal.findMany({
      where: { patientId: params.id },
      orderBy: { createdAt: 'asc' },
    })
  }

  const branding = await getBranding()
  const { html: templateHtml, guiFields } = await getDefaultReportTemplate(reportType, body.templateId)

  const bgOpacity   = ((guiFields?.bgImageOpacity ?? 0.06) as number).toFixed(2)
  const bgMode      = guiFields?.bgImageMode ?? 'behind'

  // Hauptinhalt generieren
  const contentHtml = generateContentHtml({
    reportType, patient, sessions: patient.therapySessions, assessments, goals,
    adressat, adressatTitel, adressatAdresse,
    zeitraumVon, zeitraumBis, freitext, anonymize,
    includeSessions, includeAssessments, includeGoals, includeAnamnese,
    therapistName: session.user?.name ?? '',
  })

  const patName = anonymize
    ? `${patient.firstName.charAt(0)}.${patient.lastName.charAt(0)}.`
    : `${patient.firstName} ${patient.lastName}`

  const TITLES: Record<string, string> = {
    therapiebericht: 'Therapiebericht',
    arztbrief:       'Ärztlicher Bericht',
    verlaufsbericht: 'Verlaufsbericht',
  }

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
    report_title:         `${TITLES[reportType] ?? 'Bericht'} – ${patName}`,
    today:                new Date().toLocaleDateString('de-AT', { dateStyle: 'long' }),
    therapist_name:       session.user?.name ?? '',
    patient_name:         patName,
    patient_dob:          patient.dob ? new Date(patient.dob).toLocaleDateString('de-AT', { dateStyle: 'long' }) : '—',
    header_image_base64:  guiFields?.headerImageBase64 || '',
    header_image_mime:    guiFields?.headerImageMime   || 'image/png',
    footer_image_base64:  guiFields?.footerImageBase64 || '',
    footer_image_mime:    guiFields?.footerImageMime   || 'image/png',
    bg_image_base64:      guiFields?.bgImageBase64     || '',
    bg_image_mime:        guiFields?.bgImageMime       || 'image/png',
    bg_image_opacity:     bgOpacity,
    bg_is_watermark:      bgMode === 'watermark',
    has_header_image:     !!(guiFields?.headerImageBase64),
    has_footer_image:     !!(guiFields?.footerImageBase64),
    content:              contentHtml,
  }

  const html = renderReportTemplate(templateHtml, data)

  // Archivierung: NUR beim tatsächlichen Ausstellen (Drucken/PDF), nicht bei der
  // Vorschau. Einmal archiviert, bleibt dieser Inhalt für immer unverändert -
  // spätere Branding-/Vorlagen-Änderungen wirken sich nicht mehr darauf aus.
  if (body.finalize === true) {
    await prisma.patientReportDocument.create({
      data: {
        patientId: patient.id,
        reportType,
        createdByUserId: (session.user as any).id,
        anonymized: anonymize ?? false,
        data: Buffer.from(html, 'utf8'),
        mimeType: 'text/html',
      },
    })
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

// ── HTML-Generator ──────────────────────────────────────────────────────────

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'long' }).format(new Date(d))
}
function fmtDateShort(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}
function age(dob: Date | null | undefined) {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' Jahre'
}

function generateContentHtml(opts: any): string {
  const {
    reportType, patient, sessions, assessments, goals,
    adressat, adressatTitel, adressatAdresse,
    zeitraumVon, zeitraumBis, freitext, anonymize,
    includeSessions, includeAssessments, includeGoals, includeAnamnese,
    therapistName,
  } = opts

  const patName = anonymize
    ? `${patient.firstName.charAt(0)}.${patient.lastName.charAt(0)}.`
    : `${patient.firstName} ${patient.lastName}`

  const TITLES: Record<string, string> = {
    therapiebericht: 'Therapiebericht',
    arztbrief:       'Ärztlicher Bericht / Befundbericht',
    verlaufsbericht: 'Verlaufsbericht',
  }
  const title = TITLES[reportType] ?? 'Bericht'

  const primaryDiag   = patient.diagnoses?.filter((d: any) => d.diagnosisType === 'PRIMARY')   ?? []
  const secondaryDiag = patient.diagnoses?.filter((d: any) => d.diagnosisType === 'SECONDARY') ?? []
  const sessionCount  = sessions?.length ?? 0
  const firstSession  = sessions?.[0]?.sessionDate
  const lastSession   = sessions?.[sessions.length - 1]?.sessionDate
  const anamneseSections = patient.anamnesis?.sections ?? []

  const html: string[] = []

  // ── Adressblock (Arztbrief / Therapiebericht) ──
  if ((reportType === 'arztbrief' || reportType === 'therapiebericht') && adressat) {
    html.push(`<div style="margin-bottom:6mm">
      <div style="font-size:8pt;color:#999;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1mm">An</div>
      <p style="font-size:10.5pt">${adressatTitel ? adressatTitel + ' ' : ''}${adressat}</p>
      ${adressatAdresse ? `<p style="font-size:10.5pt">${adressatAdresse.replace(/\n/g, '<br>')}</p>` : ''}
    </div>`)
  }

  // ── Betreff ──
  html.push(`<div style="font-size:13pt;font-weight:bold;color:var(--pc,#1a1a2e);margin:6mm 0 4mm;border-bottom:1.5px solid currentColor;padding-bottom:2mm">${title}</div>`)

  // ── Metadaten ──
  html.push(`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-bottom:6mm;background:#f8f8f8;padding:4mm;border-radius:4px">
    <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Patient</div><div style="font-size:10pt;font-weight:600">${patName}</div></div>
    <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Geburtsdatum</div><div style="font-size:10pt;font-weight:600">${patient.dob ? new Date(patient.dob).toLocaleDateString('de-AT', {dateStyle:'long'}) : '—'}</div></div>
    <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Zeitraum</div><div style="font-size:10pt;font-weight:600">${zeitraumVon ? new Date(zeitraumVon).toLocaleDateString('de-AT',{dateStyle:'short'}) : firstSession ? new Date(firstSession).toLocaleDateString('de-AT',{dateStyle:'short'}) : '—'} – ${zeitraumBis ? new Date(zeitraumBis).toLocaleDateString('de-AT',{dateStyle:'short'}) : lastSession ? new Date(lastSession).toLocaleDateString('de-AT',{dateStyle:'short'}) : 'laufend'}</div></div>
    <div><div style="font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em">Sitzungen</div><div style="font-size:10pt;font-weight:600">${sessionCount}</div></div>
  </div>`)

  // ── Diagnosen ──
  html.push(`<div style="margin-bottom:5mm">
    <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Diagnosen (ICD-10)</h2>
    ${primaryDiag.length === 0 && secondaryDiag.length === 0
      ? '<p style="color:#bbb;font-style:italic;font-size:10pt">Keine Diagnosen dokumentiert</p>'
      : `<ul style="list-style:none">
          ${[...primaryDiag, ...secondaryDiag].map((d: any) => `
          <li style="padding:1.5mm 0;border-bottom:.5px solid #eee;display:flex;gap:4mm;font-size:10.5pt">
            <span style="font-family:monospace;font-size:10pt;color:#555;min-width:18mm">${d.icdCode}</span>
            <span>${d.diagnosisType === 'PRIMARY' ? `<strong>${d.icdLabel}</strong>` : d.icdLabel} <span style="font-size:9pt;color:#777">(${d.diagnosisType === 'PRIMARY' ? 'Hauptdiagnose' : 'Nebendiagnose'})</span></span>
          </li>`).join('')}
        </ul>`}
  </div>`)

  // ── Anamnese ──
  if (includeAnamnese) {
    html.push(`<div style="margin-bottom:5mm">
      <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Anamnese</h2>
      ${freitext?.anamnese
        ? `<p style="font-size:10.5pt">${freitext.anamnese.replace(/\n/g, '<br>')}</p>`
        : anamneseSections.filter((s: any) => s.content).map((s: any) =>
            `<p style="font-size:10.5pt;margin-bottom:2mm"><strong>${s.title}:</strong> ${s.content.replace(/\n/g, '<br>')}</p>`
          ).join('') || '<p style="color:#bbb;font-style:italic;font-size:10pt">Keine Anamnese dokumentiert</p>'}
    </div>`)
  }

  // ── Therapiemethode ──
  html.push(`<div style="margin-bottom:5mm">
    <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Therapiemethode &amp; Rahmenbedingungen</h2>
    ${freitext?.therapiemethode
      ? `<p style="font-size:10.5pt">${freitext.therapiemethode.replace(/\n/g, '<br>')}</p>`
      : '<p style="color:#bbb;font-style:italic;font-size:10pt">Bitte ausfüllen</p>'}
  </div>`)

  // ── Verlauf ──
  html.push(`<div style="margin-bottom:5mm">
    <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">${reportType === 'verlaufsbericht' ? 'Verlauf' : 'Behandlungsverlauf &amp; Epikrise'}</h2>
    ${freitext?.verlauf
      ? `<p style="font-size:10.5pt">${freitext.verlauf.replace(/\n/g, '<br>')}</p>`
      : '<p style="color:#bbb;font-style:italic;font-size:10pt">Bitte ausfüllen</p>'}
  </div>`)

  // ── Therapieziele ──
  if (includeGoals && goals?.length > 0) {
    html.push(`<div style="margin-bottom:5mm">
      <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Therapieziele</h2>
      <ul style="padding-left:5mm;font-size:10.5pt">
        ${goals.map((g: any) => `<li style="margin-bottom:1mm">${g.title}${g.status === 'ACHIEVED' ? ' <span style="color:#2a7a3a">✓ erreicht</span>' : ''}</li>`).join('')}
      </ul>
    </div>`)
  }

  // ── Assessments ──
  if (includeAssessments && assessments?.length > 0) {
    html.push(`<div style="margin-bottom:5mm">
      <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Diagnostische Befunde / Testverfahren</h2>
      ${assessments.map((a: any) => `
        <div style="border:.5px solid #ddd;border-radius:4px;padding:3mm;margin-bottom:3mm">
          <div style="font-weight:600;font-size:10pt">${a.instrument?.shortName ?? a.instrument?.name ?? a.instrumentId ?? 'Assessment'} — ${new Date(a.completedAt).toLocaleDateString('de-AT',{dateStyle:'medium'})}</div>
          ${a.result?.clinicalSummary ? `<div style="font-size:9pt;color:#555;margin-top:1mm;font-style:italic">${a.result.clinicalSummary}</div>` : ''}
          ${a.result?.isClinicalCase ? `<div style="color:#c0392b;font-size:9.5pt;font-weight:600">Klinisch auffällig</div>` : ''}
        </div>`).join('')}
    </div>`)
  }

  // ── Sitzungsübersicht ──
  if (includeSessions) {
    html.push(`<div style="margin-bottom:5mm">
      <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Sitzungsübersicht (${sessionCount} Sitzungen)</h2>
      ${sessions?.length === 0
        ? '<p style="color:#bbb;font-style:italic;font-size:10pt">Keine Sitzungen im gewählten Zeitraum</p>'
        : `<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:2mm">
            <thead><tr>
              <th style="background:#f0f0f0;padding:2mm 3mm;text-align:left;font-weight:600;border:.5px solid #ccc">Nr.</th>
              <th style="background:#f0f0f0;padding:2mm 3mm;text-align:left;font-weight:600;border:.5px solid #ccc">Datum</th>
              <th style="background:#f0f0f0;padding:2mm 3mm;text-align:left;font-weight:600;border:.5px solid #ccc">Dauer</th>
              ${reportType === 'verlaufsbericht' ? '<th style="background:#f0f0f0;padding:2mm 3mm;text-align:left;font-weight:600;border:.5px solid #ccc">Thema</th>' : ''}
            </tr></thead>
            <tbody>
              ${sessions.map((s: any, i: number) => {
                const thema = s.protocols?.flatMap((p: any) => p.sections ?? [])
                  .find((sec: any) => sec.fieldKey?.includes('thema') || sec.label?.toLowerCase().includes('thema'))?.content ?? ''
                return `<tr style="${i % 2 === 1 ? 'background:#fafafa' : ''}">
                  <td style="padding:2mm 3mm;border:.5px solid #ddd">${i + 1}</td>
                  <td style="padding:2mm 3mm;border:.5px solid #ddd">${new Date(s.sessionDate).toLocaleDateString('de-AT',{dateStyle:'medium'})}</td>
                  <td style="padding:2mm 3mm;border:.5px solid #ddd">${s.durationMinutes ? s.durationMinutes + ' min' : '—'}</td>
                  ${reportType === 'verlaufsbericht' ? `<td style="padding:2mm 3mm;border:.5px solid #ddd">${thema}</td>` : ''}
                </tr>`
              }).join('')}
            </tbody>
          </table>`}
    </div>`)
  }

  // ── Aktueller Stand ──
  html.push(`<div style="margin-bottom:5mm">
    <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">${reportType === 'arztbrief' ? 'Aktueller Status' : 'Aktueller Behandlungsstand'}</h2>
    ${freitext?.status
      ? `<p style="font-size:10.5pt">${freitext.status.replace(/\n/g, '<br>')}</p>`
      : '<p style="color:#bbb;font-style:italic;font-size:10pt">Bitte ausfüllen</p>'}
  </div>`)

  // ── Empfehlung (nur Arztbrief) ──
  if (reportType === 'arztbrief') {
    html.push(`<div style="margin-bottom:5mm">
      <h2 style="font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5px solid #bbb;padding-bottom:1mm;margin-bottom:3mm;color:#333">Empfehlung</h2>
      ${freitext?.empfehlung
        ? `<p style="font-size:10.5pt">${freitext.empfehlung.replace(/\n/g, '<br>')}</p>`
        : '<p style="color:#bbb;font-style:italic;font-size:10pt">Bitte ausfüllen</p>'}
    </div>`)
  }

  return html.join('\n')
}

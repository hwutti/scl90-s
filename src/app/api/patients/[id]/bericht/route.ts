import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBranding } from '@/lib/branding'

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
      anamnesis: { include: { sections: { orderBy: { sortOrder: 'asc' } } } },
      sessions: {
        where: {
          ...(zeitraumVon && { sessionDate: { gte: new Date(zeitraumVon) } }),
          ...(zeitraumBis && { sessionDate: { lte: new Date(zeitraumBis) } }),
        },
        orderBy: { sessionDate: 'asc' },
        include: {
          protocols: {
            include: { sections: { orderBy: { sortOrder: 'asc' } } }
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
      include: { result: true },
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
  const html = generateReportHtml({
    reportType, patient, sessions: patient.sessions, assessments, goals,
    adressat, adressatTitel, adressatAdresse,
    zeitraumVon, zeitraumBis, freitext, anonymize,
    includeSessions, includeAssessments, includeGoals, includeAnamnese,
    branding, therapistName: session.user?.name ?? '',
  })

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

function generateReportHtml(opts: any): string {
  const { reportType, patient, sessions, assessments, goals, branding,
    adressat, adressatTitel, adressatAdresse, zeitraumVon, zeitraumBis,
    freitext, anonymize, includeSessions, includeAssessments, includeGoals,
    includeAnamnese, therapistName } = opts

  const patName = anonymize
    ? `${patient.firstName.charAt(0)}.${patient.lastName.charAt(0)}.`
    : `${patient.firstName} ${patient.lastName}`

  const praxis = branding.praxisName || 'Psychotherapeutische Praxis'
  const today = fmtDate(new Date())

  const TITLES: Record<string, string> = {
    therapiebericht: 'Therapiebericht',
    arztbrief:       'Ärztlicher Bericht / Befundbericht',
    verlaufsbericht: 'Verlaufsbericht',
  }
  const title = TITLES[reportType] ?? 'Bericht'

  const primaryDiag = patient.diagnoses?.filter((d: any) => d.diagnosisType === 'PRIMARY') ?? []
  const secondaryDiag = patient.diagnoses?.filter((d: any) => d.diagnosisType === 'SECONDARY') ?? []

  const sessionCount = sessions?.length ?? 0
  const firstSession = sessions?.[0]?.sessionDate
  const lastSession = sessions?.[sessions.length - 1]?.sessionDate

  // Anamnese-Abschnitte
  const anamneseSections = patient.anamnesis?.sections ?? []

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${title} – ${patName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
    padding: 0;
  }
  .page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 20mm 20mm 25mm 20mm;
    min-height: 297mm;
  }
  @media print {
    @page { size: A4; margin: 20mm 20mm 25mm 20mm; }
    body { padding: 0; }
    .page { padding: 0; max-width: none; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }

  /* Header */
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8mm; border-bottom: 2px solid #1a1a1a; padding-bottom: 4mm; }
  .letterhead-left h1 { font-size: 14pt; font-weight: bold; margin-bottom: 2mm; }
  .letterhead-left p { font-size: 9pt; color: #444; line-height: 1.4; }
  .letterhead-right { text-align: right; font-size: 9pt; color: #444; line-height: 1.5; }

  /* Adressblock */
  .adress-block { margin-bottom: 6mm; }
  .adress-block .label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1mm; }
  .adress-block p { font-size: 10pt; line-height: 1.5; }

  /* Betreff */
  .betreff { font-size: 12pt; font-weight: bold; margin: 6mm 0 4mm 0; border-bottom: 1px solid #ddd; padding-bottom: 2mm; }
  .meta-row { display: flex; gap: 20mm; margin-bottom: 6mm; }
  .meta-item { flex: 1; }
  .meta-item .label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta-item .value { font-size: 10pt; font-weight: 600; }

  /* Abschnitte */
  .section { margin-bottom: 6mm; }
  .section h2 { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 0.5px solid #999; padding-bottom: 1mm; margin-bottom: 3mm; color: #333; }
  .section p { margin-bottom: 2mm; font-size: 10.5pt; }
  .section .empty { color: #999; font-style: italic; font-size: 10pt; }

  /* Diagnose-Liste */
  .diag-list { list-style: none; }
  .diag-list li { padding: 1.5mm 0; border-bottom: 0.5px solid #eee; display: flex; gap: 4mm; font-size: 10.5pt; }
  .diag-list li .icd { font-family: monospace; font-size: 10pt; color: #555; min-width: 18mm; }
  .diag-list li .certainty { font-size: 9pt; color: #888; margin-left: auto; }

  /* Sitzungstabelle */
  .session-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 2mm; }
  .session-table th { background: #f0f0f0; padding: 2mm 3mm; text-align: left; font-weight: 600; border: 0.5px solid #ccc; }
  .session-table td { padding: 2mm 3mm; border: 0.5px solid #ddd; vertical-align: top; }
  .session-table tr:nth-child(even) td { background: #fafafa; }
  .session-table .protocol-text { font-size: 9pt; color: #444; margin-top: 1mm; }

  /* Assessment */
  .assessment-box { border: 0.5px solid #ccc; border-radius: 4px; padding: 3mm; margin-bottom: 3mm; }
  .assessment-box .name { font-weight: 600; font-size: 10pt; }
  .assessment-box .score { font-size: 10pt; color: #333; }
  .assessment-box .summary { font-size: 9pt; color: #555; margin-top: 1mm; font-style: italic; }

  /* Unterschrift */
  .signature { margin-top: 15mm; }
  .signature .line { border-top: 1px solid #1a1a1a; width: 70mm; margin-top: 12mm; padding-top: 1mm; font-size: 9pt; color: #444; }

  /* Footer */
  .footer { margin-top: 10mm; padding-top: 3mm; border-top: 0.5px solid #ccc; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }

  /* Druck-Button */
  .no-print {
    position: fixed; top: 12px; right: 12px; z-index: 9999;
    display: flex; gap: 8px;
  }
  .no-print button {
    padding: 8px 18px; border: none; border-radius: 8px;
    cursor: pointer; font-size: 13px; font-family: sans-serif;
  }
  .btn-print { background: #1a1a1a; color: #fff; }
  .btn-close { background: #e5e7eb; color: #374151; }
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨 Drucken / Als PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Schließen</button>
</div>

<div class="page">

  <!-- Briefkopf -->
  <div class="letterhead">
    <div class="letterhead-left">
      <h1>${praxis}</h1>
      <p>${branding.address ?? ''}</p>
      ${branding.contactEmail ? `<p>${branding.contactEmail}</p>` : ''}
      ${branding.contactPhone ? `<p>${branding.contactPhone}</p>` : ''}
    </div>
    <div class="letterhead-right">
      <p>${today}</p>
      ${therapistName ? `<p>${therapistName}</p>` : ''}
      ${branding.taxNumber || branding.vatId ? `<p>${[branding.taxNumber, branding.vatId].filter(Boolean).join(' · ')}</p>` : ''}
    </div>
  </div>

  <!-- Adressblock (bei Arztbrief) -->
  ${(reportType === 'arztbrief' || reportType === 'therapiebericht') && adressat ? `
  <div class="adress-block">
    <div class="label">An</div>
    <p>${adressatTitel ? adressatTitel + ' ' : ''}${adressat}</p>
    ${adressatAdresse ? `<p>${adressatAdresse.replace(/\n/g, '<br>')}</p>` : ''}
  </div>` : ''}

  <!-- Betreff -->
  <div class="betreff">${title}</div>

  <!-- Metadaten -->
  <div class="meta-row">
    <div class="meta-item">
      <div class="label">Patient / Klient</div>
      <div class="value">${patName}</div>
    </div>
    <div class="meta-item">
      <div class="label">Geburtsdatum</div>
      <div class="value">${fmtDate(patient.dateOfBirth)} (${age(patient.dateOfBirth)})</div>
    </div>
    <div class="meta-item">
      <div class="label">Behandlungszeitraum</div>
      <div class="value">${zeitraumVon ? fmtDateShort(zeitraumVon) : fmtDateShort(firstSession)} – ${zeitraumBis ? fmtDateShort(zeitraumBis) : (lastSession ? fmtDateShort(lastSession) : 'laufend')}</div>
    </div>
    <div class="meta-item">
      <div class="label">Sitzungen gesamt</div>
      <div class="value">${sessionCount}</div>
    </div>
  </div>

  <!-- Diagnosen -->
  <div class="section">
    <h2>Diagnosen (ICD-10)</h2>
    ${primaryDiag.length === 0 && secondaryDiag.length === 0
      ? '<p class="empty">Keine Diagnosen dokumentiert</p>'
      : `<ul class="diag-list">
          ${primaryDiag.map((d: any) => `
            <li>
              <span class="icd">${d.icdCode}</span>
              <span><strong>${d.icdLabel}</strong> <span style="font-size:9pt;color:#777">(Hauptdiagnose)</span></span>
              ${d.certainty ? `<span class="certainty">${d.certainty}</span>` : ''}
            </li>`).join('')}
          ${secondaryDiag.map((d: any) => `
            <li>
              <span class="icd">${d.icdCode}</span>
              <span>${d.icdLabel} <span style="font-size:9pt;color:#777">(Nebendiagnose)</span></span>
              ${d.certainty ? `<span class="certainty">${d.certainty}</span>` : ''}
            </li>`).join('')}
        </ul>`}
  </div>

  <!-- Anamnese (optional) -->
  ${includeAnamnese ? `
  <div class="section">
    <h2>Anamnese</h2>
    ${freitext?.anamnese
      ? `<p>${freitext.anamnese.replace(/\n/g, '<br>')}</p>`
      : anamneseSections.length > 0
        ? anamneseSections.filter((s: any) => s.content).map((s: any) =>
            `<p><strong>${s.title}:</strong> ${s.content.replace(/\n/g, '<br>')}</p>`
          ).join('')
        : '<p class="empty">Keine Anamnese dokumentiert</p>'}
  </div>` : ''}

  <!-- Therapiemethode & Behandlungsverlauf -->
  <div class="section">
    <h2>Therapiemethode &amp; Rahmenbedingungen</h2>
    ${freitext?.therapiemethode
      ? `<p>${freitext.therapiemethode.replace(/\n/g, '<br>')}</p>`
      : `<p class="empty">Bitte ausfüllen</p>`}
  </div>

  <!-- Behandlungsverlauf / Epikrise -->
  <div class="section">
    <h2>${reportType === 'verlaufsbericht' ? 'Verlauf' : 'Behandlungsverlauf &amp; Epikrise'}</h2>
    ${freitext?.verlauf
      ? `<p>${freitext.verlauf.replace(/\n/g, '<br>')}</p>`
      : `<p class="empty">Bitte ausfüllen</p>`}
  </div>

  <!-- Therapieziele -->
  ${includeGoals && goals?.length > 0 ? `
  <div class="section">
    <h2>Therapieziele</h2>
    <ul style="padding-left:5mm;font-size:10.5pt;">
      ${goals.map((g: any) => `<li style="margin-bottom:1mm">${g.title}${g.status === 'ACHIEVED' ? ' <span style="color:#2a7a3a">✓ erreicht</span>' : ''}</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Assessments -->
  ${includeAssessments && assessments?.length > 0 ? `
  <div class="section">
    <h2>Diagnostische Befunde / Testverfahren</h2>
    ${assessments.map((a: any) => {
      const scores = a.result?.scores ? (typeof a.result.scores === 'string' ? JSON.parse(a.result.scores) : a.result.scores) : {}
      return `<div class="assessment-box">
        <div class="name">${a.instrumentId ?? a.instrument?.name ?? 'Assessment'} — ${fmtDateShort(a.completedAt)}</div>
        ${a.result?.clinicalSummary ? `<div class="summary">${a.result.clinicalSummary}</div>` : ''}
        ${a.result?.isClinicalCase ? `<div class="score" style="color:#c0392b">Klinisch auffällig</div>` : ''}
      </div>`
    }).join('')}
  </div>` : ''}

  <!-- Sitzungsübersicht -->
  ${includeSessions ? `
  <div class="section ${reportType === 'verlaufsbericht' ? '' : 'page-break'}">
    <h2>Sitzungsübersicht (${sessionCount} Sitzungen)</h2>
    ${sessions?.length === 0
      ? '<p class="empty">Keine Sitzungen im gewählten Zeitraum</p>'
      : `<table class="session-table">
          <thead><tr>
            <th>Nr.</th><th>Datum</th><th>Dauer</th>
            ${reportType === 'verlaufsbericht' ? '<th>Thema / Protokoll</th>' : ''}
          </tr></thead>
          <tbody>
            ${sessions.map((s: any, i: number) => {
              const shortProto = s.protocols?.find((p: any) => p.type === 'SHORT')
              const thema = shortProto?.sections?.find((sec: any) =>
                sec.fieldKey?.includes('thema') || sec.label?.toLowerCase().includes('thema')
              )?.content ?? ''
              return `<tr>
                <td>${i + 1}</td>
                <td>${fmtDateShort(s.sessionDate)}</td>
                <td>${s.durationMinutes ? s.durationMinutes + ' min' : '—'}</td>
                ${reportType === 'verlaufsbericht'
                  ? `<td>${s.name ?? ''}${thema ? `<div class="protocol-text">${thema}</div>` : ''}</td>`
                  : ''}
              </tr>`
            }).join('')}
          </tbody>
        </table>`}
  </div>` : ''}

  <!-- Aktueller Status & Empfehlung -->
  <div class="section">
    <h2>${reportType === 'arztbrief' ? 'Aktueller Status &amp; Empfehlung' : 'Aktueller Behandlungsstand'}</h2>
    ${freitext?.status
      ? `<p>${freitext.status.replace(/\n/g, '<br>')}</p>`
      : `<p class="empty">Bitte ausfüllen</p>`}
  </div>

  ${reportType === 'arztbrief' ? `
  <div class="section">
    <h2>Empfehlung</h2>
    ${freitext?.empfehlung
      ? `<p>${freitext.empfehlung.replace(/\n/g, '<br>')}</p>`
      : `<p class="empty">Bitte ausfüllen</p>`}
  </div>` : ''}

  <!-- Datenschutz-Hinweis -->
  <div class="section" style="margin-top:6mm;padding:3mm;background:#f9f9f9;border:0.5px solid #ddd;font-size:9pt;color:#666">
    <strong>Datenschutz:</strong> Dieser Bericht enthält vertrauliche Gesundheitsdaten gem. §16a Psychotherapiegesetz (Österreich).
    Die Weitergabe ist nur mit schriftlicher Einwilligung der Patient*in zulässig. Aufbewahrungspflicht: 10 Jahre.
  </div>

  <!-- Unterschrift -->
  <div class="signature">
    <p>Mit freundlichen Grüßen,</p>
    <div class="line">${therapistName}<br>${praxis}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>${praxis} · ${branding.address ?? ''}</span>
    <span>Erstellt: ${today} · Vertraulich</span>
  </div>

</div>
</body>
</html>`
}

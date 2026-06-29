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
        orderBy: { sessionDate: 'asc' },
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

  return `<div style="font-family: inherit;">

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
      <div class="value">${fmtDate(patient.dob)} (${age(patient.dob)})</div>
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
        <div class="name">${a.instrument?.shortName ?? a.instrument?.name ?? a.instrumentId ?? 'Assessment'} — ${fmtDateShort(a.completedAt)}</div>
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
  </div>`
}

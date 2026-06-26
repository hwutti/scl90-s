import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeScore, answersArrayToMap, formatG, formatT, tBandLabel } from '@/lib/scoring'
import { ITEMS, SCALES } from '@/lib/constants'
import { calcAge } from '@/lib/utils'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assessment = await prisma.assessmentSession.findUnique({
    where: { id: params.id },
    include: { answers: { orderBy: { itemNumber: 'asc' } }, normTable: true },
  })
  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const answersMap = answersArrayToMap(assessment.answers)
  const normValues = assessment.normTable?.values as any ?? null
  const { scales, global: g } = computeScore(answersMap, normValues)
  const age = calcAge(assessment.patientDob)
  const dt = new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

  function riskColor(risk: string | null): string {
    if (risk === 'green')  return '#16a34a'
    if (risk === 'yellow') return '#d97706'
    if (risk === 'red')    return '#dc2626'
    return '#64748b'
  }

  const scaleRows = scales.map(s => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:6px 8px;font-weight:600;white-space:nowrap;">${s.id}</td>
      <td style="padding:6px 8px;">${s.name}</td>
      <td style="padding:6px 8px;font-family:monospace;font-size:11px;">${s.items.join(', ')}</td>
      <td style="padding:6px 8px;text-align:center;">${s.missing}</td>
      <td style="padding:6px 8px;text-align:center;font-weight:700;">${s.sum}</td>
      <td style="padding:6px 8px;text-align:center;font-weight:700;">${formatG(s.mean)}</td>
      <td style="padding:6px 8px;text-align:center;">
        ${s.risk ? `<span style="background:${riskColor(s.risk)}20;color:${riskColor(s.risk)};border:1px solid ${riskColor(s.risk)}40;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;">${s.risk.toUpperCase()}</span>` : '—'}
      </td>
      <td style="padding:6px 8px;text-align:center;">${s.pCount}</td>
      <td style="padding:6px 8px;text-align:center;font-weight:700;">${formatT(s.tScore)}</td>
      <td style="padding:6px 8px;font-size:11px;">${s.tScore !== null ? tBandLabel(s.tScore) : '—'}</td>
    </tr>`).join('')

  const answerRows = ITEMS.map((item, idx) => {
    const val = answersMap.get(idx + 1)
    return `<tr style="border-bottom:1px solid #f8fafc;">
      <td style="padding:4px 8px;font-family:monospace;">${idx + 1}</td>
      <td style="padding:4px 8px;font-size:12px;">${item}</td>
      <td style="padding:4px 8px;text-align:center;font-weight:700;">${val ?? '—'}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<title>SCL-90-S Auswertung – ${assessment.patientName}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:20px;}
  h1{font-size:17px;margin:0 0 4px;}
  h2{font-size:14px;margin:24px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f8fafc;text-align:left;padding:6px 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.03em;border-bottom:2px solid #e2e8f0;}
  .kpi{display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;margin:0 6px 6px 0;}
  .kpi-val{font-size:20px;font-weight:800;color:#1e293b;}
  .kpi-lbl{font-size:11px;color:#64748b;}
  .warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400e;margin-top:20px;}
  .clinical-yes{background:#fef2f2;border-left:4px solid #ef4444;padding:10px 14px;border-radius:4px;}
  .clinical-no{background:#f0fdf4;border-left:4px solid #16a34a;padding:10px 14px;border-radius:4px;}
  @media print{body{padding:0;} .pagebreak{page-break-before:always;}}
</style>
</head>
<body>
<table style="width:100%;margin-bottom:16px;">
  <tr>
    <td>
      <h1>SCL-90-S – Auswertungsbericht</h1>
      <p style="color:#64748b;margin:0;font-size:12px;">
        Patient: <strong>${assessment.patientName ?? '—'}</strong> ·
        Geschlecht: ${assessment.patientGender ?? '—'} ·
        Alter: ${age ?? '—'} ·
        Geburtsdatum: ${assessment.patientDob ?? '—'}<br/>
        Anlass: ${assessment.occasion ?? '—'} ·
        Datum: ${dt} ·
        Beantwortet: ${g.answeredTotal}/90 · Missing: ${g.missingTotal}
      </p>
    </td>
  </tr>
</table>

<div class="${g.isClinicalCase ? 'clinical-yes' : 'clinical-no'}" style="margin-bottom:16px;">
  <strong>${g.isClinicalCase ? '⚠ Klinisch auffällig (Falldefinition erfüllt)' : '✓ Kein klinischer Befund (Falldefinition nicht erfüllt)'}</strong>
  ${g.clinicalReason !== '—' ? `<br/><span style="font-size:12px;">${g.clinicalReason}</span>` : ''}
  <br/><span style="font-size:11px;color:#64748b;">Falldefinition: T(GSI) ≥ 63 oder ≥ 2 Skalen mit T ≥ 63</span>
</div>

<h2>Globale Kennwerte</h2>
<div>
  <div class="kpi"><div class="kpi-val">${g.gs}</div><div class="kpi-lbl">GS (Gesamtsumme)</div></div>
  <div class="kpi"><div class="kpi-val">${g.gsi?.toFixed(3) ?? '—'}${g.gsiT ? ` / T=${Math.round(g.gsiT)}` : ''}</div><div class="kpi-lbl">GSI</div></div>
  <div class="kpi"><div class="kpi-val">${g.pst}${g.pstT ? ` / T=${Math.round(g.pstT)}` : ''}</div><div class="kpi-lbl">PST</div></div>
  <div class="kpi"><div class="kpi-val">${g.psdi?.toFixed(3) ?? '—'}${g.psdiT ? ` / T=${Math.round(g.psdiT)}` : ''}</div><div class="kpi-lbl">PSDI</div></div>
</div>

<h2>Skalenauswertung</h2>
<p style="font-size:11px;color:#64748b;margin-bottom:6px;">Ampel: Grün &lt;0.50 · Gelb 0.50–1.49 · Rot ≥1.50 · T≥60 = auffällig (fett markiert)</p>
<table>
  <thead>
    <tr>
      <th>Skala</th><th>Bezeichnung</th><th>Items</th><th style="text-align:center;">Missing</th>
      <th style="text-align:center;">S</th><th style="text-align:center;">G</th>
      <th style="text-align:center;">Ampel</th><th style="text-align:center;">P</th>
      <th style="text-align:center;">T</th><th>T-Interpretation</th>
    </tr>
  </thead>
  <tbody>${scaleRows}</tbody>
</table>

<p style="margin-top:6px;font-size:11px;color:#64748b;">
  T-Interpretation (Richtwerte): &lt;40 unauffällig · 40–50 Durchschnitt · 50–60 leicht erhöht · 60–70 klinisch relevant möglich · &gt;70 sehr hohe Werte
</p>

<div class="pagebreak"></div>

<h2>Itemantworten (1–90)</h2>
<table>
  <thead><tr><th style="width:6%;">Item</th><th>Frage</th><th style="width:8%;text-align:center;">Wert</th></tr></thead>
  <tbody>${answerRows}</tbody>
</table>

<div class="warn" style="margin-top:16px;">
  <strong>Wichtiger Hinweis:</strong> Die SCL-90-S ist kein Diagnoseinstrument. Sie dient ausschließlich der Verlaufs- und Erfolgskontrolle
  sowie dem Screening. Eine Pathologisierung auf Basis dieser Ergebnisse ist ausdrücklich zu vermeiden (Franke, 2014).
  Die Interpretation erfordert klinische Fachkompetenz.
</div>

<script>window.addEventListener('load', () => setTimeout(() => window.print(), 100));</script>
</body></html>`

  await prisma.auditLog.create({
    data: { userId: (session.user as any).id, sessionId: params.id, action: 'SESSION_EXPORTED' },
  }).catch(() => {})

  // HTML direkt im Browser-Tab öffnen (nicht downloaden)
  // Druckdialog öffnet automatisch → "Als PDF speichern" wählen
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

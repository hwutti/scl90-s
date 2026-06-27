import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, G, Text as SvgText } from '@react-pdf/renderer'
import type { ScoringResult } from '@/lib/scoring'
import { tBandLabel, formatG, formatT } from '@/lib/scoring'
import { ITEMS } from '@/lib/constants'

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:          { fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b', paddingTop: 36, paddingBottom: 36, paddingHorizontal: 32 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 7 },
  title:         { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle:      { fontSize: 8, color: '#64748b' },

  metaRow:       { flexDirection: 'row', gap: 5, marginBottom: 9 },
  metaBox:       { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3, padding: 5, flex: 1 },
  metaLabel:     { fontSize: 7, color: '#64748b', marginBottom: 1 },
  metaValue:     { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  clinicalBox:   { borderRadius: 3, padding: 7, marginBottom: 9 },
  clinicalYes:   { backgroundColor: '#fef2f2', borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  clinicalNo:    { backgroundColor: '#f0fdf4', borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  clinicalTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  clinicalSub:   { fontSize: 8, color: '#475569' },

  sectionTitle:  { fontSize: 10, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 2, marginBottom: 6, marginTop: 10 },

  kpiRow:        { flexDirection: 'row', gap: 5, marginBottom: 4 },
  kpi:           { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3, padding: 5, flex: 1, alignItems: 'center' },
  kpiVal:        { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  kpiLbl:        { fontSize: 7, color: '#64748b', marginTop: 1 },
  kpiDesc:       { fontSize: 6, color: '#94a3b8', marginTop: 1, textAlign: 'center' },

  tableHeader:   { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  tableRow:      { flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  tableRowAlt:   { flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  tableRowHigh:  { flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', backgroundColor: '#fff7ed' },
  tableRowCrit:  { flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', backgroundColor: '#fef2f2' },
  th:            { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', paddingHorizontal: 3 },
  td:            { fontSize: 8, paddingHorizontal: 3 },
  tdBold:        { fontSize: 8, paddingHorizontal: 3, fontFamily: 'Helvetica-Bold' },
  tdCrit:        { fontSize: 8, paddingHorizontal: 3, fontFamily: 'Helvetica-Bold', color: '#dc2626' },

  badgeGreen:    { color: '#16a34a', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeYellow:   { color: '#d97706', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeRed:      { color: '#dc2626', fontSize: 7, fontFamily: 'Helvetica-Bold' },

  verlaufRow:    { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 4 },
  verlaufBox:    { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3, padding: 5, minWidth: 80, alignItems: 'center' },
  verlaufBoxAkt: { borderWidth: 1, borderColor: '#6366f1', borderRadius: 3, padding: 5, minWidth: 80, alignItems: 'center', backgroundColor: '#eef2ff' },
  verlaufDate:   { fontSize: 6, color: '#94a3b8', marginBottom: 1 },
  verlaufOcc:    { fontSize: 6, color: '#64748b', marginBottom: 2 },
  verlaufGsi:    { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  verlaufT:      { fontSize: 7, color: '#64748b' },

  disclaimer:    { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 3, padding: 6, marginTop: 8 },
  disclaimerText:{ fontSize: 8, color: '#92400e', lineHeight: 1.4 },

  footer:        { position: 'absolute', bottom: 18, left: 32, right: 32, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 3, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:    { fontSize: 7, color: '#94a3b8' },
})

// ─── Typen ───────────────────────────────────────────────────────────────────
export interface PreviousSession {
  date: string        // z.B. "15.03.2026"
  occasion: string
  gsi: number | null
  gsiT: number | null
  isClinicalCase: boolean
}

interface Props {
  patientName:    string
  patientGender:  string
  patientDob:     string
  patientAge:     number | null
  occasion:       string
  date:           string
  scoring:        ScoringResult
  answers:        Record<number, number | null>
  previousSessions?: PreviousSession[]
}

// ─── Grafisches Belastungsprofil (SVG) ───────────────────────────────────────
function ProfilChart({ scales, gsiT, pstT, psdiT }: {
  scales: ScoringResult['scales']
  gsiT: number | null
  pstT: number | null
  psdiT: number | null
}) {
  const W = 524          // Breite in pt (A4 - Margins)
  const BAR_H = 14       // Balkenhöhe
  const GAP = 4          // Abstand zwischen Balken
  const LABEL_W = 36     // Breite der Skala-Kürzel
  const T_LABEL_W = 24   // Breite für T-Wert rechts
  const BAR_W = W - LABEL_W - T_LABEL_W - 10

  // T-Skala: 30–90
  const T_MIN = 30
  const T_MAX = 90
  const tToX = (t: number) => ((Math.min(Math.max(t, T_MIN), T_MAX) - T_MIN) / (T_MAX - T_MIN)) * BAR_W

  const normStart = tToX(40)
  const normEnd   = tToX(60)
  const cutoff    = tToX(63)

  const mainScales = scales.filter(s => !s.isAddOn)
  const globals = [
    { id: 'GSI', name: 'GSI', t: gsiT },
    { id: 'PST', name: 'PST', t: pstT },
    { id: 'PSDI', name: 'PSDI', t: psdiT },
  ]
  const allBars = [...mainScales.map(s => ({ id: s.id, name: s.shortName ?? s.id, t: s.tScore, isGlobal: false })),
                   ...globals.map(g => ({ ...g, isGlobal: true }))]

  const totalH = allBars.length * (BAR_H + GAP) + 30 // 30 für Achsenbeschriftung

  const barColor = (t: number | null, isGlobal: boolean) => {
    if (t === null) return '#e2e8f0'
    if (t >= 63) return isGlobal ? '#7c3aed' : '#ef4444'
    if (t >= 60) return '#f97316'
    return '#22c55e'
  }

  return (
    <Svg width={W} height={totalH} viewBox={`0 0 ${W} ${totalH}`}>
      {/* Achsen-Ticks und Labels */}
      {[30, 40, 50, 60, 63, 70, 80, 90].map(t => {
        const x = LABEL_W + 5 + tToX(t)
        return (
          <G key={t}>
            <Line x1={x} y1={0} x2={x} y2={totalH - 20} strokeWidth={t === 63 ? 0.8 : 0.3}
              stroke={t === 63 ? '#ef4444' : '#cbd5e1'} strokeDasharray={t === 63 ? '2,2' : undefined} />
            <SvgText style={{ fontSize: 6, fill: t === 63 ? '#ef4444' : '#94a3b8' }}
              x={x} y={totalH - 8} textAnchor="middle">{String(t)}</SvgText>
          </G>
        )
      })}

      {/* Normbereich grau hinterlegt */}
      <Rect x={LABEL_W + 5 + normStart} y={0} width={normEnd - normStart}
        height={totalH - 20} fill="#f1f5f9" opacity={0.8} />

      {/* Trennlinie zwischen Skalen und globalen Kennwerten */}
      <Line
        x1={0} y1={mainScales.length * (BAR_H + GAP) - GAP / 2}
        x2={W} y2={mainScales.length * (BAR_H + GAP) - GAP / 2}
        strokeWidth={0.5} stroke="#cbd5e1" strokeDasharray="3,3"
      />

      {allBars.map((bar, i) => {
        const y = i * (BAR_H + GAP)
        const tVal = bar.t ?? 0
        const barW = bar.t !== null ? tToX(tVal) : 0
        const color = barColor(bar.t, bar.isGlobal)
        const isElevated = bar.t !== null && bar.t >= 60

        return (
          <G key={bar.id}>
            {/* Label */}
            <SvgText style={{ fontSize: 7, fill: isElevated ? '#1e293b' : '#64748b' }}
              x={0} y={y + BAR_H - 3}>{bar.id}</SvgText>

            {/* Hintergrund-Balken */}
            <Rect x={LABEL_W + 5} y={y} width={BAR_W} height={BAR_H}
              fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.3} rx={2} />

            {/* Wert-Balken */}
            {bar.t !== null && (
              <Rect x={LABEL_W + 5} y={y} width={Math.max(barW, 2)} height={BAR_H}
                fill={color} opacity={0.85} rx={2} />
            )}

            {/* T-Wert rechts */}
            <SvgText style={{ fontSize: 7, fill: isElevated ? '#dc2626' : '#64748b' }}
              x={W - T_LABEL_W + 2} y={y + BAR_H - 3}>{bar.t !== null ? `T=${Math.round(bar.t)}` : '—'}</SvgText>
          </G>
        )
      })}
    </Svg>
  )
}

// ─── Verlaufs-Miniaturansicht ─────────────────────────────────────────────────
function VerlaufSection({ previous, current, currentDate, currentOccasion }: {
  previous: PreviousSession[]
  current: ScoringResult['global']
  currentDate: string
  currentOccasion: string
}) {
  const all = [
    ...previous,
    { date: currentDate, occasion: currentOccasion, gsi: current.gsi, gsiT: current.gsiT, isClinicalCase: current.isClinicalCase, isCurrent: true },
  ]

  return (
    <View>
      <Text style={S.sectionTitle}>Verlauf – GSI im Überblick</Text>
      <View style={S.verlaufRow}>
        {all.map((s, i) => {
          const isCurrent = i === all.length - 1
          const gsiColor = s.gsiT && s.gsiT >= 63 ? '#ef4444' : s.gsiT && s.gsiT >= 60 ? '#f97316' : '#16a34a'
          return (
            <View key={i} style={isCurrent ? S.verlaufBoxAkt : S.verlaufBox}>
              <Text style={S.verlaufDate}>{s.date}</Text>
              <Text style={S.verlaufOcc}>{s.occasion || '—'}</Text>
              <Text style={[S.verlaufGsi, { color: gsiColor }]}>
                {s.gsi !== null ? s.gsi.toFixed(2) : '—'}
              </Text>
              <Text style={S.verlaufT}>
                {s.gsiT !== null ? `T=${Math.round(s.gsiT!)}` : ''}
                {isCurrent ? ' ◀ aktuell' : ''}
              </Text>
              {s.isClinicalCase && (
                <Text style={{ fontSize: 6, color: '#ef4444', marginTop: 1 }}>⚠ auffällig</Text>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export function AuswertungPdf({ patientName, patientGender, patientDob, patientAge, occasion, date, scoring, answers, previousSessions = [] }: Props) {
  const { scales, global: g } = scoring
  const mainScales = scales.filter(s => !s.isAddOn)

  // Kritische Items: Suizid/Tod (Item 15, 59) immer hervorheben
  const SUICIDAL_ITEMS = new Set([15, 59])

  // Flagged Items: Wert ≥ 2 in Skalen mit T ≥ 60
  const elevatedScaleItems = new Set<number>()
  for (const s of mainScales) {
    if (s.tScore !== null && s.tScore >= 60) {
      s.flaggedItems.forEach(n => elevatedScaleItems.add(n))
    }
  }

  return (
    <Document title={`SCL-90-S – ${patientName}`}>

      {/* ═══════════════════════════════════════════════════════════════
          SEITE 1: Auswertung + Skalentabelle
      ═══════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.title}>SCL-90-S – Auswertungsbericht</Text>
            <Text style={S.subtitle}>Symptom-Checkliste 90 Standard · Franke (2014)</Text>
          </View>
          <Text style={S.subtitle}>{date}</Text>
        </View>

        {/* Patientendaten */}
        <View style={S.metaRow}>
          {[
            ['Patient',      patientName || '—'],
            ['Geschlecht',   patientGender || '—'],
            ['Alter',        patientAge ? `${patientAge} J.` : '—'],
            ['Geburtsdatum', patientDob || '—'],
            ['Anlass',       occasion || '—'],
            ['Beantwortet',  `${g.answeredTotal}/90`],
          ].map(([label, value]) => (
            <View key={label} style={S.metaBox}>
              <Text style={S.metaLabel}>{label}</Text>
              <Text style={S.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Falldefinition */}
        <View style={[S.clinicalBox, g.isClinicalCase ? S.clinicalYes : S.clinicalNo]}>
          <Text style={S.clinicalTitle}>
            {g.isClinicalCase ? '⚠  Klinisch auffällig – Falldefinition erfüllt' : '✓  Kein klinischer Befund – Falldefinition nicht erfüllt'}
          </Text>
          {g.clinicalReason !== '—' && <Text style={S.clinicalSub}>{g.clinicalReason}</Text>}
          <Text style={S.clinicalSub}>Falldefinition: T(GSI) ≥ 63 oder ≥ 2 Skalen mit T ≥ 63</Text>
        </View>

        {/* Globale Kennwerte */}
        <Text style={S.sectionTitle}>Globale Kennwerte</Text>
        <View style={S.kpiRow}>
          {[
            ['GS',   `${g.gs}`,                                           'Gesamtrohwert (Summe aller Items)'],
            ['GSI',  `${g.gsi?.toFixed(2) ?? '—'}${g.gsiT ? `  T=${Math.round(g.gsiT)}` : ''}`, 'Allgemeine Belastung (GS / Items)'],
            ['PST',  `${g.pst}${g.pstT ? `  T=${Math.round(g.pstT)}` : ''}`,                    'Anzahl belasteter Symptome (>0)'],
            ['PSDI', `${g.psdi?.toFixed(2) ?? '—'}${g.psdiT ? `  T=${Math.round(g.psdiT)}` : ''}`, 'Antwortintensität (GS / PST)'],
            ['Missing', `${g.missingTotal}`,                              'Nicht beantwortete Items'],
          ].map(([label, value, desc]) => (
            <View key={label} style={S.kpi}>
              <Text style={S.kpiVal}>{value}</Text>
              <Text style={S.kpiLbl}>{label}</Text>
              <Text style={S.kpiDesc}>{desc}</Text>
            </View>
          ))}
        </View>

        {/* Verlauf (nur wenn Vorwerte vorhanden) */}
        {previousSessions.length > 0 && (
          <VerlaufSection
            previous={previousSessions}
            current={g}
            currentDate={date}
            currentOccasion={occasion}
          />
        )}

        {/* Skalentabelle */}
        <Text style={S.sectionTitle}>Skalenauswertung</Text>
        <Text style={{ fontSize: 7, color: '#64748b', marginBottom: 4 }}>
          G = Mittelwert je Skala · Ampel: Grün &lt;0.50 · Gelb 0.50–1.49 · Rot ≥1.50 · T≥60 auffällig · T≥63 klinisch relevant
        </Text>

        <View style={S.tableHeader}>
          {[['Skala','7%'],['Bezeichnung','17%'],['Items','17%'],['Miss','5%'],['S','5%'],['G','6%'],['P','4%'],['T','6%'],['T-Interpretation','27%'],['Auffäll. Items','6%']].map(([l,w]) => (
            <Text key={l} style={[S.th, { width: w }]}>{l}</Text>
          ))}
        </View>

        {scales.map((s, i) => {
          const elevated  = !s.isAddOn && s.tScore !== null && s.tScore >= 60
          const clinical  = !s.isAddOn && s.tScore !== null && s.tScore >= 63
          const row = clinical ? S.tableRowCrit : elevated ? S.tableRowHigh : i % 2 === 0 ? S.tableRow : S.tableRowAlt
          const riskStyle = s.risk === 'green' ? S.badgeGreen : s.risk === 'yellow' ? S.badgeYellow : S.badgeRed
          const riskLabel = s.risk === 'green' ? '●' : s.risk === 'yellow' ? '●' : s.risk === 'red' ? '●' : '—'
          const tColor = clinical ? '#dc2626' : elevated ? '#d97706' : '#1e293b'

          return (
            <View key={s.id} style={row}>
              <Text style={[S.tdBold, { width: '7%' }]}>{s.id}</Text>
              <Text style={[S.td, { width: '17%', fontSize: 7 }]}>{s.name}</Text>
              <Text style={[S.td, { width: '17%', fontSize: 6 }]}>{s.items.join(', ')}</Text>
              <Text style={[S.td, { width: '5%', textAlign: 'center' }]}>{s.missing}</Text>
              <Text style={[S.tdBold, { width: '5%', textAlign: 'center' }]}>{s.sum}</Text>
              <Text style={[S.tdBold, { width: '6%', textAlign: 'center' }]}>{formatG(s.mean)}</Text>
              <Text style={[S.td, { width: '4%', textAlign: 'center' }]}>{s.pCount}</Text>
              <Text style={[S.tdBold, { width: '6%', textAlign: 'center', color: tColor }]}>{formatT(s.tScore)}</Text>
              <Text style={[S.td, { width: '27%', fontSize: 7 }]}>{s.tScore !== null ? tBandLabel(s.tScore) : '—'}</Text>
              <Text style={[S.td, { width: '6%', fontSize: 6, color: '#dc2626' }]}>
                {s.flaggedItems.length > 0 ? s.flaggedItems.join(',') : ''}
              </Text>
            </View>
          )
        })}

        <View style={S.disclaimer}>
          <Text style={[S.disclaimerText, { fontFamily: 'Helvetica-Bold', marginBottom: 2 }]}>⚠ Wichtiger Hinweis</Text>
          <Text style={S.disclaimerText}>
            Die SCL-90-S ist kein Diagnoseinstrument. Sie dient der Verlaufs- und Erfolgskontrolle sowie dem Screening.
            Die Interpretation erfordert klinische Fachkompetenz (Franke, 2014).
          </Text>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>SCL-90-S · {patientName} · {date}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════
          SEITE 2: Grafisches Belastungsprofil
      ═══════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.title}>Grafisches Belastungsprofil</Text>
            <Text style={S.subtitle}>SCL-90-S · {patientName} · {date}</Text>
          </View>
          <Text style={S.subtitle}>{occasion || ''}</Text>
        </View>

        {/* Legende */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <View style={{ width: 10, height: 8, backgroundColor: '#f1f5f9', borderWidth: 0.5, borderColor: '#cbd5e1' }} />
            <Text style={{ fontSize: 7, color: '#64748b' }}>Normbereich (T 40–60)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <View style={{ width: 10, height: 8, backgroundColor: '#22c55e' }} />
            <Text style={{ fontSize: 7, color: '#64748b' }}>unauffällig (&lt;T60)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <View style={{ width: 10, height: 8, backgroundColor: '#f97316' }} />
            <Text style={{ fontSize: 7, color: '#64748b' }}>erhöht (T60–62)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <View style={{ width: 10, height: 8, backgroundColor: '#ef4444' }} />
            <Text style={{ fontSize: 7, color: '#64748b' }}>klinisch auffällig (T≥63)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <View style={{ width: 10, height: 8, backgroundColor: '#7c3aed' }} />
            <Text style={{ fontSize: 7, color: '#64748b' }}>Globale Kennwerte</Text>
          </View>
        </View>

        <ProfilChart
          scales={mainScales}
          gsiT={g.gsiT}
          pstT={g.pstT}
          psdiT={g.psdiT}
        />

        {/* Klinische Zusammenfassung */}
        <Text style={[S.sectionTitle, { marginTop: 14 }]}>Klinische Zusammenfassung</Text>
        <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3, padding: 8 }}>
          <Text style={{ fontSize: 9, lineHeight: 1.6 }}>
            {g.isClinicalCase
              ? `Die vorliegende Auswertung ergibt einen klinisch auffälligen Befund (Falldefinition erfüllt). ${g.clinicalReason} Die erhöhten Skalenwerte weisen auf folgende Symptomschwerpunkte hin: ${mainScales.filter(s => s.tScore !== null && s.tScore >= 63).map(s => s.name).join(', ') || '—'}. Eine weiterführende diagnostische Abklärung durch klinische Fachkompetenz wird empfohlen.`
              : 'Die vorliegende Auswertung ergibt keinen klinisch auffälligen Befund. Die globalen Kennwerte und Skalenwerte befinden sich im Normbereich. Eine Verlaufsmessung zu einem späteren Zeitpunkt kann zur Therapieerfolgskontrolle sinnvoll sein.'
            }
          </Text>
        </View>

        {/* Handlungsempfehlungen */}
        <Text style={[S.sectionTitle, { marginTop: 10 }]}>Handlungsempfehlungen</Text>
        <View style={{ gap: 4 }}>
          {g.isClinicalCase && (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 8, color: '#dc2626', fontFamily: 'Helvetica-Bold' }}>▶</Text>
              <Text style={{ fontSize: 8, flex: 1 }}>
                Klinisch auffälliger Befund: Weiterführende psychodiagnostische Untersuchung durch Fachperson empfohlen.
              </Text>
            </View>
          )}
          {mainScales.filter(s => s.tScore !== null && s.tScore >= 63).map(s => (
            <View key={s.id} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 8, color: '#d97706' }}>•</Text>
              <Text style={{ fontSize: 8, flex: 1 }}>
                {s.name} (T={Math.round(s.tScore!)}): {tBandLabel(s.tScore)} – gezielte Exploration dieser Symptomdimension empfohlen.
              </Text>
            </View>
          ))}
          {g.answeredTotal < 85 && (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 8, color: '#7c3aed' }}>▶</Text>
              <Text style={{ fontSize: 8, flex: 1 }}>
                Nur {g.answeredTotal}/90 Items beantwortet – Ergebnisse sind eingeschränkt interpretierbar. Vollständige Bearbeitung anstreben.
              </Text>
            </View>
          )}
          {previousSessions.length === 0 && (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 8, color: '#64748b' }}>•</Text>
              <Text style={{ fontSize: 8, flex: 1 }}>
                Verlaufsmessung: Wiederholung nach 4–8 Wochen zur Therapieerfolgskontrolle empfohlen.
              </Text>
            </View>
          )}
        </View>

        <View style={S.disclaimer}>
          <Text style={[S.disclaimerText, { fontFamily: 'Helvetica-Bold', marginBottom: 2 }]}>⚠ Wichtiger Hinweis</Text>
          <Text style={S.disclaimerText}>
            Die SCL-90-S ist kein Diagnoseinstrument. Sie dient der Verlaufs- und Erfolgskontrolle sowie dem Screening.
            Die Interpretation erfordert klinische Fachkompetenz (Franke, 2014).
          </Text>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>SCL-90-S · {patientName} · {date}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════
          SEITE 3+: Itemantworten (mit Markierung kritischer Items)
      ═══════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.title}>Itemantworten (1–90)</Text>
            <Text style={S.subtitle}>{patientName} · {date}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.subtitle}>Markierungen: 🔴 klinisch auffällige Skala (T≥63)  ⚠ Suizid/Tod-Item</Text>
          </View>
        </View>

        <View style={S.tableHeader}>
          <Text style={[S.th, { width: '6%' }]}>Nr.</Text>
          <Text style={[S.th, { width: '80%' }]}>Frage</Text>
          <Text style={[S.th, { width: '7%', textAlign: 'center' }]}>Wert</Text>
          <Text style={[S.th, { width: '7%', textAlign: 'center' }]}>Flag</Text>
        </View>

        {ITEMS.map((item, idx) => {
          const itemNo = idx + 1
          const val = answers[itemNo]
          const isSuicidal = SUICIDAL_ITEMS.has(itemNo)
          const isElevatedItem = elevatedScaleItems.has(itemNo)
          const isCritical = isSuicidal || (isElevatedItem && val !== null && val >= 3)

          const rowStyle = isSuicidal
            ? S.tableRowCrit
            : isElevatedItem
              ? S.tableRowHigh
              : idx % 2 === 0 ? S.tableRow : S.tableRowAlt

          return (
            <View key={idx} style={rowStyle}>
              <Text style={[S.tdBold, { width: '6%' }]}>{itemNo}</Text>
              <Text style={[
                isCritical ? S.tdCrit : S.td,
                { width: '80%', fontSize: 7 }
              ]}>{item}</Text>
              <Text style={[
                val !== null && val >= 3 ? S.tdCrit : S.tdBold,
                { width: '7%', textAlign: 'center' }
              ]}>{val !== null ? val : '—'}</Text>
              <Text style={[S.td, { width: '7%', textAlign: 'center', fontSize: 8 }]}>
                {isSuicidal ? '⚠' : isElevatedItem && val !== null && val >= 2 ? '🔴' : ''}
              </Text>
            </View>
          )
        })}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>SCL-90-S · {patientName} · {date}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>
      </Page>

    </Document>
  )
}

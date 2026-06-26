import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ScoringResult } from '@/lib/scoring'
import { tBandLabel, formatG, formatT } from '@/lib/scoring'
import { ITEMS } from '@/lib/constants'

const S = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b', paddingTop: 40, paddingBottom: 40, paddingHorizontal: 35 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  subtitle: { fontSize: 8, color: '#64748b' },
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  metaBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3, padding: 5, flex: 1 },
  metaLabel: { fontSize: 7, color: '#64748b', marginBottom: 1 },
  metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  clinicalBox: { borderRadius: 3, padding: 7, marginBottom: 10 },
  clinicalYes: { backgroundColor: '#fef2f2', borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  clinicalNo: { backgroundColor: '#f0fdf4', borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  clinicalTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  clinicalSub: { fontSize: 8, color: '#475569' },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 2, marginBottom: 5, marginTop: 10 },
  kpiRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  kpi: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3, padding: 5, flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  kpiLbl: { fontSize: 7, color: '#64748b', marginTop: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  tableRow: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  tableRowHigh: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', backgroundColor: '#fffbeb' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', paddingHorizontal: 3 },
  td: { fontSize: 8, paddingHorizontal: 3 },
  tdBold: { fontSize: 8, paddingHorizontal: 3, fontFamily: 'Helvetica-Bold' },
  badgeGreen: { color: '#16a34a', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeYellow: { color: '#d97706', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeRed: { color: '#dc2626', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  disclaimer: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 3, padding: 6, marginTop: 10 },
  disclaimerText: { fontSize: 8, color: '#92400e', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 20, left: 35, right: 35, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 3, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

interface Props {
  patientName: string
  patientGender: string
  patientDob: string
  patientAge: number | null
  occasion: string
  date: string
  scoring: ScoringResult
  answers: Record<number, number | null>
}

export function AuswertungPdf({ patientName, patientGender, patientDob, patientAge, occasion, date, scoring, answers }: Props) {
  const { scales, global: g } = scoring

  return (
    <Document title={`SCL-90-S – ${patientName}`}>

      {/* Seite 1: Auswertung */}
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.title}>SCL-90-S – Auswertungsbericht</Text>
            <Text style={S.subtitle}>Symptom-Checkliste 90 Standard · Franke (2014)</Text>
          </View>
          <Text style={S.subtitle}>{date}</Text>
        </View>

        <View style={S.metaRow}>
          {[
            ['Patient', patientName || '—'],
            ['Geschlecht', patientGender || '—'],
            ['Alter', patientAge ? `${patientAge} J.` : '—'],
            ['Geburtsdatum', patientDob || '—'],
            ['Anlass', occasion || '—'],
            ['Beantwortet', `${g.answeredTotal}/90`],
          ].map(([label, value]) => (
            <View key={label} style={S.metaBox}>
              <Text style={S.metaLabel}>{label}</Text>
              <Text style={S.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={[S.clinicalBox, g.isClinicalCase ? S.clinicalYes : S.clinicalNo]}>
          <Text style={S.clinicalTitle}>
            {g.isClinicalCase ? '⚠  Klinisch auffällig – Falldefinition erfüllt' : '✓  Kein klinischer Befund – Falldefinition nicht erfüllt'}
          </Text>
          {g.clinicalReason !== '—' && <Text style={S.clinicalSub}>{g.clinicalReason}</Text>}
          <Text style={S.clinicalSub}>Falldefinition: T(GSI) ≥ 63 oder ≥ 2 Skalen mit T ≥ 63</Text>
        </View>

        <Text style={S.sectionTitle}>Globale Kennwerte</Text>
        <View style={S.kpiRow}>
          {[
            ['GS', `${g.gs}`],
            ['GSI', `${g.gsi?.toFixed(3) ?? '—'}${g.gsiT ? `  T=${Math.round(g.gsiT)}` : ''}`],
            ['PST', `${g.pst}${g.pstT ? `  T=${Math.round(g.pstT)}` : ''}`],
            ['PSDI', `${g.psdi?.toFixed(3) ?? '—'}`],
            ['Missing', `${g.missingTotal}`],
          ].map(([label, value]) => (
            <View key={label} style={S.kpi}>
              <Text style={S.kpiVal}>{value}</Text>
              <Text style={S.kpiLbl}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={S.sectionTitle}>Skalenauswertung</Text>
        <Text style={{ fontSize: 7, color: '#64748b', marginBottom: 4 }}>
          G = Summe / (Items − Missing) · Ampel: Grün &lt;0.50 · Gelb 0.50–1.49 · Rot ≥1.50 · T≥60 auffällig
        </Text>

        <View style={S.tableHeader}>
          {[['Skala','7%'],['Bezeichnung','16%'],['Items','18%'],['Miss','5%'],['S','5%'],['G','6%'],['Ampel','7%'],['P','4%'],['T','5%'],['T-Interpretation','22%']].map(([l,w]) => (
            <Text key={l} style={[S.th, { width: w }]}>{l}</Text>
          ))}
        </View>

        {scales.map((s, i) => {
          const elevated = !s.isAddOn && s.tScore !== null && s.tScore >= 60
          const row = elevated ? S.tableRowHigh : i % 2 === 0 ? S.tableRow : S.tableRowAlt
          const riskStyle = s.risk === 'green' ? S.badgeGreen : s.risk === 'yellow' ? S.badgeYellow : S.badgeRed
          const riskLabel = s.risk === 'green' ? 'GRÜN' : s.risk === 'yellow' ? 'GELB' : s.risk === 'red' ? 'ROT' : '—'
          return (
            <View key={s.id} style={row}>
              <Text style={[S.tdBold, { width: '7%' }]}>{s.id}</Text>
              <Text style={[S.td, { width: '16%', fontSize: 7 }]}>{s.name}</Text>
              <Text style={[S.td, { width: '18%', fontSize: 6 }]}>{s.items.join(', ')}</Text>
              <Text style={[S.td, { width: '5%', textAlign: 'center' }]}>{s.missing}</Text>
              <Text style={[S.tdBold, { width: '5%', textAlign: 'center' }]}>{s.sum}</Text>
              <Text style={[S.tdBold, { width: '6%', textAlign: 'center' }]}>{formatG(s.mean)}</Text>
              <Text style={[riskStyle, { width: '7%', textAlign: 'center' }]}>{riskLabel}</Text>
              <Text style={[S.td, { width: '4%', textAlign: 'center' }]}>{s.pCount}</Text>
              <Text style={[elevated ? S.tdBold : S.td, { width: '5%', textAlign: 'center', color: elevated ? '#d97706' : '#1e293b' }]}>{formatT(s.tScore)}</Text>
              <Text style={[S.td, { width: '22%', fontSize: 7 }]}>{s.tScore !== null ? tBandLabel(s.tScore) : '—'}</Text>
            </View>
          )
        })}

        <View style={S.disclaimer}>
          <Text style={[S.disclaimerText, { fontFamily: 'Helvetica-Bold', marginBottom: 1 }]}>⚠ Wichtiger Hinweis</Text>
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

      {/* Seite 2: Itemantworten */}
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <Text style={S.title}>Itemantworten (1–90)</Text>
          <Text style={S.subtitle}>{patientName} · {date}</Text>
        </View>

        <View style={S.tableHeader}>
          <Text style={[S.th, { width: '7%' }]}>Nr.</Text>
          <Text style={[S.th, { width: '85%' }]}>Frage</Text>
          <Text style={[S.th, { width: '8%', textAlign: 'center' }]}>Wert</Text>
        </View>

        {ITEMS.map((item, idx) => {
          const val = answers[idx + 1]
          return (
            <View key={idx} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.tdBold, { width: '7%' }]}>{idx + 1}</Text>
              <Text style={[S.td, { width: '85%', fontSize: 7 }]}>{item}</Text>
              <Text style={[S.tdBold, { width: '8%', textAlign: 'center' }]}>{val ?? '—'}</Text>
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

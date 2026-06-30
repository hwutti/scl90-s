import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page:          { fontFamily: 'Helvetica', fontSize: 9.5, color: '#1e293b', paddingTop: 36, paddingBottom: 40, paddingHorizontal: 34 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 10 },
  logo:          { width: 36, height: 36, objectFit: 'contain', marginBottom: 4 },
  praxisName:    { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  praxisMeta:    { fontSize: 8, color: '#64748b', marginTop: 1 },
  title:         { fontSize: 15, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  subtitle:      { fontSize: 9, color: '#64748b', textAlign: 'right', marginTop: 2 },

  disclaimer:    { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 3, padding: 8, marginBottom: 12 },
  disclaimerText:{ fontSize: 8, color: '#92400e', lineHeight: 1.4 },

  kpiRow:        { flexDirection: 'row', gap: 6, marginBottom: 14 },
  kpi:           { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 8, flex: 1 },
  kpiLbl:        { fontSize: 7, color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  kpiVal:        { fontSize: 13, fontFamily: 'Helvetica-Bold' },

  sectionTitle:  { fontSize: 10.5, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 3, marginBottom: 6, marginTop: 14 },

  tableHeader:   { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4, paddingHorizontal: 4 },
  tableRow:      { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  tableRowTotal: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 1 },
  th:            { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#64748b' },
  td:            { fontSize: 9 },
  tdBold:        { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  colLabel:      { flex: 3 },
  colVal:        { flex: 1, textAlign: 'right' },

  footer:        { position: 'absolute', bottom: 18, left: 34, right: 34, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:    { fontSize: 7, color: '#94a3b8' },
})

export interface ProfitStatementPdfProps {
  year: number
  praxisName: string
  praxisAddress: string | null
  taxNumber: string | null
  vatId: string | null
  logoSrc: string | null
  generatedAt: string
  income: { byCategory: Record<string, number>; total: number }
  ustSplit: { befreitNetto: number; pflichtigNetto: number; pflichtigUst: number; legacyOhneZuordnung: number }
  expenses: { byCategory: Record<string, number>; mileage: number; mileageKm: number; total: number }
  profit: number
  grundfreibetrag: number
  einkuenfte: number
  incomeLabels: Record<string, string>
  expenseLabels: Record<string, string>
}

const fmt = (n: number) => n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export function ProfitStatementPdf(p: ProfitStatementPdfProps) {
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            {p.logoSrc && <Image src={p.logoSrc} style={S.logo} />}
            <Text style={S.praxisName}>{p.praxisName}</Text>
            {p.praxisAddress && <Text style={S.praxisMeta}>{p.praxisAddress}</Text>}
            {p.taxNumber && <Text style={S.praxisMeta}>StNr. {p.taxNumber}{p.vatId ? `  ·  UID ${p.vatId}` : ''}</Text>}
          </View>
          <View>
            <Text style={S.title}>Einnahmen-Ausgaben-Aufstellung</Text>
            <Text style={S.subtitle}>Wirtschaftsjahr {p.year}</Text>
            <Text style={S.subtitle}>Erstellt am {p.generatedAt}</Text>
          </View>
        </View>

        <View style={S.disclaimer}>
          <Text style={S.disclaimerText}>
            Diese Aufstellung dient der Orientierung und stellt keine verbindliche Steuerberatung dar.
            Bitte wenden Sie sich für die endgültige steuerliche Beurteilung an eine zugelassene Steuerberatung.
          </Text>
        </View>

        <View style={S.kpiRow}>
          <View style={S.kpi}><Text style={S.kpiLbl}>Einnahmen gesamt</Text><Text style={S.kpiVal}>{fmt(p.income.total)}</Text></View>
          <View style={S.kpi}><Text style={S.kpiLbl}>Ausgaben gesamt</Text><Text style={S.kpiVal}>{fmt(p.expenses.total)}</Text></View>
          <View style={S.kpi}><Text style={S.kpiLbl}>Gewinn</Text><Text style={S.kpiVal}>{fmt(p.profit)}</Text></View>
          <View style={S.kpi}><Text style={S.kpiLbl}>Einkünfte (n. Freibetrag)</Text><Text style={S.kpiVal}>{fmt(p.einkuenfte)}</Text></View>
        </View>

        <Text style={S.sectionTitle}>Umsatzsteuerliche Zuordnung der Einnahmen</Text>
        <View style={S.tableHeader}>
          <Text style={[S.th, S.colLabel]}>Kategorie</Text>
          <Text style={[S.th, S.colVal]}>Netto</Text>
          <Text style={[S.th, S.colVal]}>USt</Text>
        </View>
        <View style={S.tableRow}>
          <Text style={[S.td, S.colLabel]}>Honorare – USt-befreit (§ 6 Abs 1 Z 19 UStG)</Text>
          <Text style={[S.td, S.colVal]}>{fmt(p.ustSplit.befreitNetto)}</Text>
          <Text style={[S.td, S.colVal]}>–</Text>
        </View>
        {p.ustSplit.pflichtigNetto > 0 && (
          <View style={S.tableRow}>
            <Text style={[S.td, S.colLabel]}>Sonstige Leistungen – USt-pflichtig (z. B. Supervision)</Text>
            <Text style={[S.td, S.colVal]}>{fmt(p.ustSplit.pflichtigNetto)}</Text>
            <Text style={[S.td, S.colVal]}>{fmt(p.ustSplit.pflichtigUst)}</Text>
          </View>
        )}
        {p.ustSplit.legacyOhneZuordnung > 0 && (
          <View style={S.tableRow}>
            <Text style={[S.td, S.colLabel]}>Sonstige Einnahmen (Alt-Erfassung, ohne USt-Zuordnung)</Text>
            <Text style={[S.td, S.colVal]}>{fmt(p.ustSplit.legacyOhneZuordnung)}</Text>
            <Text style={[S.td, S.colVal]}>–</Text>
          </View>
        )}

        <Text style={S.sectionTitle}>Einnahmen nach Kategorie</Text>
        <View style={S.tableHeader}>
          <Text style={[S.th, S.colLabel]}>Kategorie</Text>
          <Text style={[S.th, S.colVal]}>Betrag</Text>
        </View>
        {Object.entries(p.income.byCategory).map(([cat, val]) => (
          <View style={S.tableRow} key={cat}>
            <Text style={[S.td, S.colLabel]}>{p.incomeLabels[cat] ?? cat}</Text>
            <Text style={[S.td, S.colVal]}>{fmt(val)}</Text>
          </View>
        ))}
        <View style={S.tableRowTotal}>
          <Text style={[S.tdBold, S.colLabel]}>Summe Einnahmen</Text>
          <Text style={[S.tdBold, S.colVal]}>{fmt(p.income.total)}</Text>
        </View>

        <Text style={S.sectionTitle}>Ausgaben nach Kategorie</Text>
        <View style={S.tableHeader}>
          <Text style={[S.th, S.colLabel]}>Kategorie</Text>
          <Text style={[S.th, S.colVal]}>Betrag</Text>
        </View>
        {Object.entries(p.expenses.byCategory).map(([cat, val]) => (
          <View style={S.tableRow} key={cat}>
            <Text style={[S.td, S.colLabel]}>{p.expenseLabels[cat] ?? cat}</Text>
            <Text style={[S.td, S.colVal]}>{fmt(val)}</Text>
          </View>
        ))}
        {p.expenses.mileage > 0 && (
          <View style={S.tableRow}>
            <Text style={[S.td, S.colLabel]}>Fahrtenbuch / Kilometergeld ({p.expenses.mileageKm.toLocaleString('de-AT')} km)</Text>
            <Text style={[S.td, S.colVal]}>{fmt(p.expenses.mileage)}</Text>
          </View>
        )}
        <View style={S.tableRowTotal}>
          <Text style={[S.tdBold, S.colLabel]}>Summe Ausgaben</Text>
          <Text style={[S.tdBold, S.colVal]}>{fmt(p.expenses.total)}</Text>
        </View>

        <Text style={S.sectionTitle}>Gewinnermittlung (Einnahmen-Ausgaben-Rechnung)</Text>
        <View style={S.tableRow}>
          <Text style={[S.td, S.colLabel]}>Einnahmen – Ausgaben = Gewinn</Text>
          <Text style={[S.td, S.colVal]}>{fmt(p.profit)}</Text>
        </View>
        <View style={S.tableRow}>
          <Text style={[S.td, S.colLabel]}>Grundfreibetrag (15 % des Gewinns)</Text>
          <Text style={[S.td, S.colVal]}>− {fmt(p.grundfreibetrag)}</Text>
        </View>
        <View style={S.tableRowTotal}>
          <Text style={[S.tdBold, S.colLabel]}>Einkünfte aus selbständiger Arbeit</Text>
          <Text style={[S.tdBold, S.colVal]}>{fmt(p.einkuenfte)}</Text>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>{p.praxisName} · Einnahmen-Ausgaben-Aufstellung {p.year}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

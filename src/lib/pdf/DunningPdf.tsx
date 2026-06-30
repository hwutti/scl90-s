import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 10.5, color: '#1e293b', paddingTop: 38, paddingBottom: 40, paddingHorizontal: 40, lineHeight: 1.5 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo:        { width: 34, height: 34, objectFit: 'contain', marginBottom: 4 },
  praxisName:  { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  praxisMeta:  { fontSize: 8, color: '#64748b', marginTop: 1 },
  dateBlock:   { fontSize: 9, color: '#64748b', textAlign: 'right' },

  addressBlock:{ marginBottom: 28 },
  addressLine: { fontSize: 10.5 },

  title:       { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 14 },
  paragraph:   { marginBottom: 12 },

  infoBox:     { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 12, marginVertical: 14 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLbl:     { fontSize: 9.5, color: '#64748b' },
  infoVal:     { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  infoValBig:  { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

  signature:   { marginTop: 30 },

  footer:      { position: 'absolute', bottom: 18, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 4 },
  footerText:  { fontSize: 7, color: '#94a3b8' },
})

export interface DunningPdfProps {
  level: 'ERINNERUNG' | 'MAHNUNG_1' | 'MAHNUNG_2'
  praxisName: string
  praxisAddress: string | null
  logoSrc: string | null
  letterDate: string
  payerName: string
  payerAddress: string | null
  referenceNumber: string
  invoiceDate: string
  dueDate: string
  amountGross: string
  daysOverdue: number
  previousSentAt: string | null
}

const TITLES: Record<DunningPdfProps['level'], string> = {
  ERINNERUNG: 'Zahlungserinnerung',
  MAHNUNG_1: '1. Mahnung',
  MAHNUNG_2: '2. Mahnung',
}

function bodyText(p: DunningPdfProps): string[] {
  if (p.level === 'ERINNERUNG') {
    return [
      'bei der Durchsicht unserer offenen Posten ist uns aufgefallen, dass die unten angeführte Honorarnote noch nicht beglichen wurde. Möglicherweise haben Sie die Überweisung schlicht übersehen.',
      'Wir bitten Sie, den ausstehenden Betrag in den nächsten Tagen zu überweisen. Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.',
    ]
  }
  if (p.level === 'MAHNUNG_1') {
    return [
      `trotz unserer Zahlungserinnerung${p.previousSentAt ? ` vom ${p.previousSentAt}` : ''} ist die unten angeführte Honorarnote weiterhin offen.`,
      'Wir bitten Sie, den ausstehenden Betrag ohne weiteren Aufschub zu begleichen. Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.',
    ]
  }
  return [
    `trotz unserer bisherigen Erinnerungen${p.previousSentAt ? ` (zuletzt am ${p.previousSentAt})` : ''} ist die unten angeführte Honorarnote weiterhin unbeglichen.`,
    'Wir bitten Sie letztmalig, den ausstehenden Betrag umgehend zu überweisen. Sollte bis zum Erhalt dieses Schreibens keine Zahlung bei uns eingelangt sein, müssen wir uns weitere Schritte vorbehalten.',
    'Falls eine Ratenzahlung für Sie leichter umsetzbar ist, sprechen Sie uns gerne direkt an - wir finden sicher eine Lösung.',
  ]
}

export function DunningPdf(p: DunningPdfProps) {
  const paragraphs = bodyText(p)
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            {p.logoSrc && <Image src={p.logoSrc} style={S.logo} />}
            <Text style={S.praxisName}>{p.praxisName}</Text>
            {p.praxisAddress && <Text style={S.praxisMeta}>{p.praxisAddress}</Text>}
          </View>
          <Text style={S.dateBlock}>{p.letterDate}</Text>
        </View>

        <View style={S.addressBlock}>
          <Text style={S.addressLine}>{p.payerName}</Text>
          {p.payerAddress && p.payerAddress.split('\n').map((line, i) => (
            <Text style={S.addressLine} key={i}>{line}</Text>
          ))}
        </View>

        <Text style={S.title}>{TITLES[p.level]}</Text>

        <Text style={S.paragraph}>Sehr geehrte/r {p.payerName},</Text>
        {paragraphs.map((t, i) => <Text style={S.paragraph} key={i}>{t}</Text>)}

        <View style={S.infoBox}>
          <View style={S.infoRow}><Text style={S.infoLbl}>Rechnungsnummer</Text><Text style={S.infoVal}>{p.referenceNumber}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLbl}>Rechnungsdatum</Text><Text style={S.infoVal}>{p.invoiceDate}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLbl}>Ursprüngliche Fälligkeit</Text><Text style={S.infoVal}>{p.dueDate}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLbl}>Tage überfällig</Text><Text style={S.infoVal}>{p.daysOverdue}</Text></View>
          <View style={[S.infoRow, { marginBottom: 0, marginTop: 6 }]}><Text style={S.infoLbl}>Offener Betrag</Text><Text style={S.infoValBig}>{p.amountGross}</Text></View>
        </View>

        <Text style={S.paragraph}>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</Text>

        <View style={S.signature}>
          <Text>Mit freundlichen Grüßen</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', marginTop: 4 }}>{p.praxisName}</Text>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>{p.praxisName} - {TITLES[p.level]} zu Rechnung {p.referenceNumber}</Text>
        </View>
      </Page>
    </Document>
  )
}

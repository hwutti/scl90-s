import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseBmdSettings } from '@/lib/finance/categoryLabels'
import { computeTransactionJournal } from '@/lib/finance/transactionJournal'

// GET /api/finance/bmd-export?year=2026&anonymize=true|false
// Erzeugt eine BMD-konventionsgemäße Buchungs-CSV (Semikolon-getrennt, UTF-8).
// WICHTIG: Das exakte BMD-NTCS-Importformat ist nicht öffentlich dokumentiert
// und variiert je nach Kanzlei. Diese Datei folgt den bekannten allgemeinen
// Konventionen (Semikolon, UTF-8, ein Beleg pro Zeile, Erlös-/Aufwandskonto)
// und MUSS vor der ersten echten Übermittlung mit dem Steuerberater
// abgestimmt werden (Kontonummern unter Finanzen → BMD-Export → Einstellungen).
//
// anonymize=true (Standard): Patientennamen werden durch den stabilen
// Codenamen (KL-XXX) aus dem Patientenprofil ersetzt. anonymize=false:
// echte Namen werden mitgeliefert. Die Belegnummer + ein "Bezug"-Feld bei
// Stornos sorgen in beiden Fällen für einen klar nachvollziehbaren
// Rechnungsfluss.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())
  const anonymize = searchParams.get('anonymize') !== 'false'

  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  const bmd = parseBmdSettings(config?.bmdSettings)

  const journal = await computeTransactionJournal(userId, role, year, anonymize)

  const fmtDate = (d: Date) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'short' }).format(d)
  const fmtNum = (n: number) => n.toFixed(2).replace('.', ',')
  const csvField = (s: string) => `"${s.replace(/"/g, '""')}"`

  function kontoFor(e: typeof journal[number]): string {
    if (e.direction === 'INCOME') {
      return e.ustSatz > 0 ? bmd.erlosUstPflichtig : bmd.erlosUstBefreit
    }
    return bmd.expenseAccounts[e.category] ?? bmd.expenseAccounts.MISC_BUSINESS
  }

  const header = ['Datum', 'Belegnummer', 'Konto', 'Patient', 'Text', 'Bezug', 'Nettobetrag', 'USt-Satz', 'USt-Betrag', 'Bruttobetrag', 'Typ']
  const lines = [header.join(';')]
  for (const e of journal) {
    lines.push([
      fmtDate(e.date), e.belegnummer, kontoFor(e), csvField(e.patientLabel), csvField(e.description),
      csvField(e.bezug ?? ''), fmtNum(e.netto), fmtNum(e.ustSatz), fmtNum(e.ustBetrag), fmtNum(e.brutto),
      e.direction === 'INCOME' ? 'E' : 'A',
    ].join(';'))
  }
  const csv = '\uFEFF' + lines.join('\r\n') // BOM für korrekte Umlaute beim Öffnen in Excel/BMD

  await prisma.auditLog.create({
    data: { userId, action: 'FINANCE_DATA_EXPORTED', details: { action: 'bmd_export', year, anonymize } },
  }).catch(() => {})

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bmd-export-${year}${anonymize ? '-anonym' : ''}.csv"`,
    },
  })
}

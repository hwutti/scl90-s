import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseBmdSettings } from '@/lib/finance/categoryLabels'

// GET /api/finance/bmd-export?year=2026
// Erzeugt eine BMD-konventionsgemäße Buchungs-CSV (Semikolon-getrennt, UTF-8).
// WICHTIG: Das exakte BMD-NTCS-Importformat ist nicht öffentlich dokumentiert
// und variiert je nach Kanzlei. Diese Datei folgt den bekannten allgemeinen
// Konventionen (Semikolon, UTF-8, ein Beleg pro Zeile, Erlös-/Aufwandskonto)
// und MUSS vor der ersten echten Übermittlung mit dem Steuerberater
// abgestimmt werden (Kontonummern unter Finanzen → BMD-Export → Einstellungen).
//
// Aus Gründen der therapeutischen Verschwiegenheit werden auf Einnahmenseite
// keine Patientennamen exportiert, sondern nur die interne Belegnummer.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())

  const dateRange = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) }
  const where: any = role === 'ADMIN' ? {} : { createdByUserId: userId }

  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  const bmd = parseBmdSettings(config?.bmdSettings)

  const transactions = await prisma.transaction.findMany({
    where: { ...where, transactionDate: dateRange, lifecycleStatus: { in: ['ACTIVE'] } },
    select: {
      direction: true, referenceNumber: true, transactionDate: true,
      amountNet: true, amountGross: true, vatRate: true, vatAmount: true, sourceType: true,
    },
    orderBy: { transactionDate: 'asc' },
  })

  const legacyTxs = await prisma.financeTransaction.findMany({
    where: { createdBy: userId, date: dateRange },
    select: {
      type: true, amount: true, date: true, description: true,
      incomeCategory: true, expenseCategory: true, invoiceNumber: true,
    },
    orderBy: { date: 'asc' },
  })

  type Row = { datum: string; beleg: string; konto: string; text: string; netto: number; ustSatz: number; ustBetrag: number; brutto: number; typ: 'E' | 'A' }
  const rows: Row[] = []
  const fmtDate = (d: Date) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'short' }).format(d)
  const fmtNum = (n: number) => n.toFixed(2).replace('.', ',')

  for (const t of transactions) {
    if (t.direction === 'INCOME') {
      const ust = Number(t.vatRate) > 0
      rows.push({
        datum: fmtDate(t.transactionDate),
        beleg: t.referenceNumber,
        konto: ust ? bmd.erlosUstPflichtig : bmd.erlosUstBefreit,
        text: ust ? 'Honorar (USt-pflichtig)' : 'Honorar (USt-befreit § 6 Abs 1 Z 19 UStG)',
        netto: Number(t.amountNet), ustSatz: Number(t.vatRate) * 100,
        ustBetrag: Number(t.vatAmount), brutto: Number(t.amountGross), typ: 'E',
      })
    } else {
      // EXPENSE-Richtung im neuen Transaction-Modell (Stornos/Korrekturen)
      rows.push({
        datum: fmtDate(t.transactionDate), beleg: t.referenceNumber,
        konto: bmd.expenseAccounts.SESSION_TRANS ?? '7700',
        text: t.sourceType === 'CANCELLATION' ? 'Storno Honorar' : 'Korrektur',
        netto: Number(t.amountNet), ustSatz: Number(t.vatRate) * 100,
        ustBetrag: Number(t.vatAmount), brutto: Number(t.amountGross), typ: 'A',
      })
    }
  }

  for (const t of legacyTxs) {
    const amount = Number(t.amount)
    if (t.type === 'INCOME') {
      rows.push({
        datum: fmtDate(t.date), beleg: t.invoiceNumber ?? '',
        konto: bmd.erlosUstBefreit, text: t.description || (t.incomeCategory ?? 'Sonstige Einnahme'),
        netto: amount, ustSatz: 0, ustBetrag: 0, brutto: amount, typ: 'E',
      })
    } else {
      const konto = bmd.expenseAccounts[t.expenseCategory ?? 'MISC_BUSINESS'] ?? bmd.expenseAccounts.MISC_BUSINESS
      rows.push({
        datum: fmtDate(t.date), beleg: t.invoiceNumber ?? '',
        konto, text: t.description || (t.expenseCategory ?? 'Sonstige Ausgabe'),
        netto: amount, ustSatz: 0, ustBetrag: 0, brutto: amount, typ: 'A',
      })
    }
  }

  const header = ['Datum', 'Belegnummer', 'Konto', 'Text', 'Nettobetrag', 'USt-Satz', 'USt-Betrag', 'Bruttobetrag', 'Typ']
  const lines = [header.join(';')]
  for (const r of rows) {
    lines.push([
      r.datum, r.beleg, r.konto, `"${r.text.replace(/"/g, '""')}"`,
      fmtNum(r.netto), fmtNum(r.ustSatz), fmtNum(r.ustBetrag), fmtNum(r.brutto), r.typ,
    ].join(';'))
  }
  const csv = '\uFEFF' + lines.join('\r\n') // BOM für korrekte Umlaute beim Öffnen in Excel/BMD

  await prisma.auditLog.create({
    data: { userId, action: 'FINANCE_DATA_EXPORTED', details: { action: 'bmd_export', year } },
  }).catch(() => {})

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bmd-export-${year}.csv"`,
    },
  })
}

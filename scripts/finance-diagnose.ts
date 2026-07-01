/**
 * Finanz-Diagnose: prüft auf Doppelzählung zwischen Transaction (neues Modell)
 * und FinanceTransaction (Legacy), verwaiste Verknüpfungen, Duplikate.
 *
 * Nur LESEND — verändert keine Daten. Sicher beliebig oft ausführbar.
 *
 * Aufruf:
 *   sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && npx tsx scripts/finance-diagnose.ts"
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function fmtEur(n: number): string {
  return n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

async function main() {
  console.log('='.repeat(70))
  console.log('KDS FINANZ-DIAGNOSE')
  console.log('='.repeat(70))

  // ── 1. Grundzahlen ────────────────────────────────────────────────────────
  const txAll = await prisma.transaction.findMany({
    select: {
      id: true, referenceNumber: true, direction: true, lifecycleStatus: true,
      amountGross: true, transactionDate: true, patientId: true, sourceType: true,
    },
  })
  const ftAll = await prisma.financeTransaction.findMany({
    select: {
      id: true, invoiceNumber: true, type: true, amount: true, date: true,
      patientId: true, description: true,
    },
  })

  console.log(`\nTransaction (neues Modell):  ${txAll.length} Datensätze`)
  console.log(`FinanceTransaction (Legacy): ${ftAll.length} Datensätze`)

  const txActive = txAll.filter(t => t.lifecycleStatus === 'ACTIVE')
  const txCancelled = txAll.filter(t => t.lifecycleStatus === 'CANCELLED_ORIGINAL')
  console.log(`  davon Transaction ACTIVE:            ${txActive.length}`)
  console.log(`  davon Transaction CANCELLED_ORIGINAL: ${txCancelled.length}`)

  const txIncomeActive = txActive.filter(t => t.direction === 'INCOME')
  const ftIncome = ftAll.filter(f => f.type === 'INCOME')
  const ftExpense = ftAll.filter(f => f.type === 'EXPENSE')
  console.log(`  Transaction ACTIVE + INCOME:  ${txIncomeActive.length}`)
  console.log(`  FinanceTransaction INCOME:    ${ftIncome.length}`)
  console.log(`  FinanceTransaction EXPENSE:   ${ftExpense.length}`)

  // ── 2. Doppelzählung: Belegnummern in BEIDEN Tabellen ────────────────────
  console.log('\n' + '-'.repeat(70))
  console.log('DOPPELZÄHLUNG: Belegnummern, die in Transaction UND FinanceTransaction vorkommen')
  console.log('-'.repeat(70))

  const txRefSet = new Map(txIncomeActive.map(t => [t.referenceNumber, t]))
  const duplicates: { ref: string; txAmount: number; ftAmount: number; ftId: string; ftDesc: string }[] = []

  for (const ft of ftIncome) {
    if (ft.invoiceNumber && txRefSet.has(ft.invoiceNumber)) {
      const tx = txRefSet.get(ft.invoiceNumber)!
      duplicates.push({
        ref: ft.invoiceNumber,
        txAmount: Number(tx.amountGross),
        ftAmount: Number(ft.amount),
        ftId: ft.id,
        ftDesc: ft.description ?? '',
      })
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ Keine Überschneidungen gefunden.')
  } else {
    console.log(`❌ ${duplicates.length} Belegnummern doppelt erfasst:\n`)
    console.log('Belegnr.'.padEnd(12) + 'Transaction'.padEnd(15) + 'FinanceTransaction'.padEnd(20) + 'FT-Beschreibung')
    let sumDuplicated = 0
    for (const d of duplicates) {
      console.log(
        d.ref.padEnd(12) + fmtEur(d.txAmount).padEnd(15) + fmtEur(d.ftAmount).padEnd(20) + d.ftDesc
      )
      sumDuplicated += d.ftAmount
    }
    console.log(`\nSumme der doppelt gezählten Beträge (nur FinanceTransaction-Seite): ${fmtEur(sumDuplicated)}`)
    console.log('→ Das ist der Betrag, um den BMD-Export und Steuerberater-PDF aktuell zu hoch sind.')
  }

  // ── 3. Summen-Vergleich (aktueller Bug-Zustand vs. bereinigt) ────────────
  console.log('\n' + '-'.repeat(70))
  console.log('SUMMEN-VERGLEICH')
  console.log('-'.repeat(70))
  const sumTxIncome = txIncomeActive.reduce((s, t) => s + Number(t.amountGross), 0)
  const sumFtIncome = ftIncome.reduce((s, t) => s + Number(t.amount), 0)
  const sumDuplicatedFt = duplicates.reduce((s, d) => s + d.ftAmount, 0)
  console.log(`Einnahmen nur aus Transaction:                 ${fmtEur(sumTxIncome)}`)
  console.log(`Einnahmen nur aus FinanceTransaction:           ${fmtEur(sumFtIncome)}`)
  console.log(`Summe aktuell in Reports (Transaction+FT):      ${fmtEur(sumTxIncome + sumFtIncome)}  ⚠ enthält Duplikate`)
  console.log(`Summe bereinigt (Duplikate abgezogen):          ${fmtEur(sumTxIncome + sumFtIncome - sumDuplicatedFt)}`)

  // ── 4. Verdacht auf Vorzeichen-Bug bei Stornos ────────────────────────────
  console.log('\n' + '-'.repeat(70))
  console.log('VERDÄCHTIGE STORNO-BUCHUNGEN (Math.abs()-Bug)')
  console.log('-'.repeat(70))
  const suspiciousStornos = ftAll.filter(f =>
    (f.description ?? '').toLowerCase().includes('storno') && Number(f.amount) > 0
  )
  if (suspiciousStornos.length === 0) {
    console.log('✅ Keine FinanceTransaction mit "Storno" im Text gefunden.')
  } else {
    console.log(`⚠ ${suspiciousStornos.length} FinanceTransaction-Zeilen mit "Storno" im Text, aber POSITIVEM Betrag:`)
    for (const s of suspiciousStornos) {
      console.log(`  ${s.invoiceNumber ?? '—'}: ${fmtEur(Number(s.amount))} — "${s.description}"`)
    }
    console.log('→ Diese sollten vermutlich negativ (Korrektur) statt positiv (zusätzliche Einnahme) sein.')
  }

  // ── 5. Sitzungs-Verknüpfung: Rechnungen ohne TxSessionAllocation ─────────
  console.log('\n' + '-'.repeat(70))
  console.log('SITZUNGS-VERKNÜPFUNG')
  console.log('-'.repeat(70))
  const allocations = await prisma.txSessionAllocation.findMany({ select: { transactionId: true } })
  const allocatedTxIds = new Set(allocations.map(a => a.transactionId))
  const txWithoutAllocation = txIncomeActive.filter(t => !allocatedTxIds.has(t.id))
  console.log(`Transaction (INCOME, ACTIVE) gesamt:        ${txIncomeActive.length}`)
  console.log(`davon mit mind. 1 TxSessionAllocation:      ${txIncomeActive.length - txWithoutAllocation.length}`)
  console.log(`davon OHNE jede Sitzungsverknüpfung:         ${txWithoutAllocation.length}`)
  if (txWithoutAllocation.length > 0) {
    console.log('  (nicht zwingend ein Fehler — kann an nicht exakt matchenden Sitzungsnamen liegen)')
    console.log('  Belegnummern: ' + txWithoutAllocation.map(t => t.referenceNumber).join(', '))
  }

  // ── 6. Duplikate innerhalb derselben Tabelle (sollte durch Dedup verhindert sein) ──
  console.log('\n' + '-'.repeat(70))
  console.log('DUPLIKAT-CHECK INNERHALB DER TABELLEN')
  console.log('-'.repeat(70))
  const refCounts = new Map<string, number>()
  for (const t of txAll) refCounts.set(t.referenceNumber, (refCounts.get(t.referenceNumber) ?? 0) + 1)
  const txDupes = [...refCounts.entries()].filter(([, c]) => c > 1)
  console.log(`Transaction mit doppelter referenceNumber: ${txDupes.length} ${txDupes.length === 0 ? '✅' : '❌ ' + JSON.stringify(txDupes)}`)

  const patients = await prisma.patient.findMany({ where: { codeName: { not: null } }, select: { codeName: true } })
  const codeNameCounts = new Map<string, number>()
  for (const p of patients) codeNameCounts.set(p.codeName!, (codeNameCounts.get(p.codeName!) ?? 0) + 1)
  const patientDupes = [...codeNameCounts.entries()].filter(([, c]) => c > 1)
  console.log(`Patienten mit doppeltem codeName:          ${patientDupes.length} ${patientDupes.length === 0 ? '✅' : '❌ ' + JSON.stringify(patientDupes)}`)

  console.log('\n' + '='.repeat(70))
  console.log('ENDE DER DIAGNOSE')
  console.log('='.repeat(70))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

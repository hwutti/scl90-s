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
  // WICHTIG: prüft sowohl INCOME als auch EXPENSE -- vorher wurde hier nur die
  // Einnahmen-Seite geprüft, wodurch unklar blieb, ob die 16 (Stand Juli 2026)
  // Legacy-EXPENSE-Zeilen (Miete, Fortbildung, Strom, ...) überhaupt schon als
  // Transaction existieren. Das muss VOR einem Löschen der Tabelle klar sein.
  console.log('\n' + '-'.repeat(70))
  console.log('DOPPELZÄHLUNG: Belegnummern, die in Transaction UND FinanceTransaction vorkommen')
  console.log('-'.repeat(70))

  const txRefSetAll = new Map(txActive.map(t => [t.referenceNumber, t]))
  const duplicates: { ref: string; type: string; txAmount: number; ftAmount: number; ftId: string; ftDesc: string }[] = []

  for (const ft of ftAll) {
    if (ft.invoiceNumber && txRefSetAll.has(ft.invoiceNumber)) {
      const tx = txRefSetAll.get(ft.invoiceNumber)!
      duplicates.push({
        ref: ft.invoiceNumber,
        type: ft.type,
        txAmount: Number(tx.amountGross),
        ftAmount: Number(ft.amount),
        ftId: ft.id,
        ftDesc: ft.description ?? '',
      })
    }
  }

  const dupIncome = duplicates.filter(d => d.type === 'INCOME')
  const dupExpense = duplicates.filter(d => d.type === 'EXPENSE')
  const ftWithoutMatch = ftAll.filter(f => !duplicates.some(d => d.ftId === f.id))

  if (duplicates.length === 0) {
    console.log('✅ Keine Überschneidungen gefunden.')
  } else {
    console.log(`${duplicates.length} Belegnummern existieren in BEIDEN Tabellen (${dupIncome.length} INCOME, ${dupExpense.length} EXPENSE):\n`)
    console.log('Typ'.padEnd(9) + 'Belegnr.'.padEnd(12) + 'Transaction'.padEnd(15) + 'FinanceTransaction'.padEnd(20) + 'FT-Beschreibung')
    for (const d of duplicates) {
      console.log(
        d.type.padEnd(9) + d.ref.padEnd(12) + fmtEur(d.txAmount).padEnd(15) + fmtEur(d.ftAmount).padEnd(20) + d.ftDesc
      )
    }
  }

  console.log(`\n${ftWithoutMatch.length === 0 ? '✅' : '❌'} FinanceTransaction-Zeilen OHNE passende Transaction: ${ftWithoutMatch.length}`)
  if (ftWithoutMatch.length > 0) {
    console.log('→ ACHTUNG: Diese Zeilen sind NUR in FinanceTransaction vorhanden. Ein Löschen der Tabelle')
    console.log('  würde diese Daten unwiederbringlich entfernen. Vor dem Löschen erst migrieren')
    console.log('  (scripts/legacy-financetransaction-migrate.ts) oder manuell klären:')
    for (const f of ftWithoutMatch) {
      console.log(`  ${(f.invoiceNumber ?? f.id).padEnd(20)} ${f.type.padEnd(8)} ${fmtEur(Number(f.amount)).padEnd(12)} ${f.description ?? ''}`)
    }
  } else {
    console.log('→ Jede FinanceTransaction-Zeile hat eine passende Transaction mit gleicher Belegnummer.')
    console.log('  Die Tabelle enthält aktuell nur noch redundante (bereits migrierte) Daten.')
  }

  // ── 3. Summen-Übersicht ───────────────────────────────────────────────────
  // Hinweis: computeTransactionJournal() (BMD-Export, Steuerberater-PDF) liest
  // ausschließlich aus Transaction -- die Summen hier sind KEIN Abbild eines
  // aktuell fehlerhaften Reports, sondern zeigen nur, wie viel Legacy-Daten
  // in FinanceTransaction stecken und wie viel davon bereits als Transaction
  // dupliziert vorliegt.
  console.log('\n' + '-'.repeat(70))
  console.log('SUMMEN-ÜBERSICHT')
  console.log('-'.repeat(70))
  const sumTxIncome = txIncomeActive.reduce((s, t) => s + Number(t.amountGross), 0)
  const sumFtIncome = ftIncome.reduce((s, t) => s + Number(t.amount), 0)
  const sumFtExpense = ftExpense.reduce((s, t) => s + Number(t.amount), 0)
  const sumDuplicated = duplicates.reduce((s, d) => s + d.ftAmount, 0)
  console.log(`Einnahmen in Transaction (aktive Quelle für Reports): ${fmtEur(sumTxIncome)}`)
  console.log(`Einnahmen in FinanceTransaction (Legacy):             ${fmtEur(sumFtIncome)}`)
  console.log(`Ausgaben in FinanceTransaction (Legacy):              ${fmtEur(sumFtExpense)}`)
  console.log(`Davon bereits als Transaction dupliziert vorhanden:   ${fmtEur(sumDuplicated)}`)

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

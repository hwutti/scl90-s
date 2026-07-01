/**
 * Übernimmt alle verbleibenden FinanceTransaction-Zeilen (Legacy) als vollwertige
 * Transaction-Datensätze — letzter Schritt der Vereinheitlichung des Finanzmodells.
 *
 * Nach diesem Lauf schreibt und liest kein Code-Pfad mehr aktiv aus
 * FinanceTransaction (siehe therapsyExecutor.ts, transactionJournal.ts,
 * profitStatement.ts, FinanceClient.tsx — alle bereits umgestellt). Die alte
 * Tabelle wird NICHT automatisch gelöscht, bleibt als Sicherheitsnetz bestehen.
 *
 * Läuft in einer einzigen DB-Transaktion (alles oder nichts). Vorschau per
 * Default, --yes zum tatsächlichen Ausführen.
 *
 * Aufruf (Vorschau):
 *   sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && npx tsx scripts/legacy-financetransaction-migrate.ts"
 *
 * Aufruf (ausführen):
 *   sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && npx tsx scripts/legacy-financetransaction-migrate.ts --yes"
 */
import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()
const EXECUTE = process.argv.includes('--yes')

function fmtEur(n: number): string {
  return n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans) }))
}

// FinanceTransaction.paymentStatus (PENDING|PAID|OVERDUE|CANCELLED) → TxPaymentStatus (UNPAID|PAID) + lifecycleStatus
function mapStatus(status: string): { paymentStatus: 'PAID' | 'UNPAID'; lifecycleStatus: 'ACTIVE' | 'CANCELLED_ORIGINAL' } {
  if (status === 'CANCELLED') return { paymentStatus: 'UNPAID', lifecycleStatus: 'CANCELLED_ORIGINAL' }
  if (status === 'PAID') return { paymentStatus: 'PAID', lifecycleStatus: 'ACTIVE' }
  return { paymentStatus: 'UNPAID', lifecycleStatus: 'ACTIVE' } // PENDING, OVERDUE
}

async function main() {
  console.log('='.repeat(70))
  console.log(`LEGACY FINANCETRANSACTION → TRANSACTION MIGRATION ${EXECUTE ? '(AUSFÜHRUNG)' : '(NUR VORSCHAU)'}`)
  console.log('='.repeat(70))

  const legacy = await prisma.financeTransaction.findMany({
    include: { patient: { select: { firstName: true, lastName: true, codeName: true } } },
  })

  if (legacy.length === 0) {
    console.log('\n✅ Keine FinanceTransaction-Zeilen mehr vorhanden. Nichts zu tun.')
    return
  }

  // Bereits existierende Transaction-Belegnummern — falls doch nochmal eine
  // Belegnummer kollidiert, überspringen statt einen zweiten Datensatz anzulegen.
  const existingRefs = new Set((await prisma.transaction.findMany({ select: { referenceNumber: true } })).map(t => t.referenceNumber))

  const therapistUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, name: true } })
  if (!therapistUser) {
    console.error('❌ Kein Admin-User gefunden — Migration kann createdByUserId nicht setzen. Abgebrochen.')
    return
  }
  const praxisName = therapistUser.name ?? 'Praxis'

  console.log(`\n${legacy.length} FinanceTransaction-Zeilen gefunden.\n`)

  let seq = 0
  const toCreate: { refNum: string; data: any; lineItem: any; skip?: string }[] = []

  for (const ft of legacy) {
    const refNum = ft.invoiceNumber || `LEGACY-${ft.id}`
    if (existingRefs.has(refNum)) {
      toCreate.push({ refNum, data: null, lineItem: null, skip: `Belegnummer ${refNum} existiert bereits als Transaction — übersprungen` })
      continue
    }
    existingRefs.add(refNum) // innerhalb dieses Laufs auch gegen sich selbst schützen

    const { paymentStatus, lifecycleStatus } = mapStatus(ft.paymentStatus)
    const amount = Number(ft.amount)
    const direction = ft.type
    const category = direction === 'INCOME' ? (ft.incomeCategory ?? 'HONORAR') : (ft.expenseCategory ?? 'MISC_BUSINESS')
    const patientName = ft.patient ? [ft.patient.firstName, ft.patient.lastName].filter(Boolean).join(' ') : null

    const data = {
      patientId: ft.patientId,
      createdByUserId: therapistUser.id,
      direction,
      sourceType: 'MANUAL' as const,
      referenceNumber: refNum,
      transactionDate: ft.date,
      payerName: direction === 'INCOME' ? (patientName ?? ft.description ?? 'Unbekannt') : praxisName,
      payeeName: direction === 'INCOME' ? praxisName : (ft.description ?? 'Unbekannt'),
      amountNet: amount,
      vatRate: 0,
      vatAmount: 0,
      amountGross: amount,
      category,
      paymentStatus,
      paidAt: paymentStatus === 'PAID' ? ft.date : null,
      paymentMethod: paymentStatus === 'PAID' ? 'UNBAR_BANK_TRANSFER' as const : null,
      lifecycleStatus,
      notes: `Migriert aus Legacy-FinanceTransaction (${ft.description ?? ''})`.trim(),
    }
    const lineItem = {
      description: ft.description || `Legacy-Buchung ${refNum}`,
      quantity: 1, unitPriceNet: amount, amountNet: amount,
      vatRate: 0, vatAmount: 0, amountGross: amount, lineDate: ft.date,
    }
    toCreate.push({ refNum, data, lineItem })
  }

  const willCreate = toCreate.filter(t => !t.skip)
  const willSkip = toCreate.filter(t => t.skip)

  console.log(`Werden migriert: ${willCreate.length}`)
  let sumIncome = 0, sumExpense = 0
  for (const t of willCreate) {
    const amt = Number(t.data.amountGross)
    if (t.data.direction === 'INCOME') sumIncome += amt; else sumExpense += amt
    console.log(`  ${t.refNum.padEnd(20)} ${t.data.direction.padEnd(8)} ${fmtEur(amt).padEnd(12)} ${t.data.category}`)
  }
  console.log(`  Summe Einnahmen: ${fmtEur(sumIncome)} · Summe Ausgaben: ${fmtEur(sumExpense)}`)

  if (willSkip.length > 0) {
    console.log(`\n⚠ Übersprungen (Belegnummer-Kollision, bitte manuell prüfen): ${willSkip.length}`)
    for (const t of willSkip) console.log(`  ${t.skip}`)
  }

  if (!EXECUTE) {
    console.log('\n─────────────────────────────────────────────────')
    console.log('Das war nur eine Vorschau. Nichts wurde verändert.')
    console.log('Zum tatsächlichen Ausführen: Script mit --yes Flag erneut starten.')
    console.log('─────────────────────────────────────────────────')
    return
  }

  const answer = await ask(`\n⚠ ${willCreate.length} neue Transaction-Datensätze werden angelegt. Fortfahren? (ja/nein): `)
  if (answer.trim().toLowerCase() !== 'ja') {
    console.log('Abgebrochen, nichts verändert.')
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const t of willCreate) {
      const created = await tx.transaction.create({ data: t.data })
      await tx.txLineItem.create({ data: { ...t.lineItem, transactionId: created.id } })
    }
  })

  console.log(`\n✅ ${willCreate.length} Datensätze migriert.`)
  console.log('Die alten FinanceTransaction-Zeilen bleiben als Sicherheitsnetz bestehen (nicht gelöscht).')
  console.log('Führe scripts/finance-diagnose.ts erneut aus, um das Ergebnis zu prüfen.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

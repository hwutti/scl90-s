/**
 * Finanz-Bereinigung: entfernt FinanceTransaction-Duplikate, die bereits als
 * vollständige Transaction importiert wurden (siehe finance-diagnose.ts).
 *
 * Regel:
 *  - FinanceTransaction.invoiceNumber existiert als Transaction.referenceNumber
 *    UND die Beschreibung deutet auf denselben Vorgang hin (kein reiner Zufalls-
 *    treffer wie E26043/Privateinlage) → FinanceTransaction wird GELÖSCHT.
 *    Die Transaction-Seite ist die vollständigere/korrektere Quelle (Sitzungs-
 *    verknüpfung, korrektes Vorzeichen, Originaldokument) und bleibt bestehen.
 *  - Bekannte Ausnahme E26043 (Privateinlage, kein echtes Duplikat, nur zufällige
 *    Belegnummern-Kollision mit einer echten Honorarrechnung): wird NICHT
 *    gelöscht, sondern umbenannt, damit die Kollision nicht wieder auftaucht.
 *
 * Läuft in einer einzigen DB-Transaktion — entweder alles oder nichts.
 * Vor dem eigentlichen Löschen wird eine Vorschau ausgegeben; Ausführung nur
 * nach Bestätigung (--yes Flag) oder interaktiver Eingabe.
 *
 * Aufruf (erst Vorschau, ohne Änderungen):
 *   sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && npx tsx scripts/finance-cleanup.ts"
 *
 * Aufruf (tatsächlich ausführen):
 *   sudo -u kds bash -c "set -a; source /opt/kds/.env; set +a; cd /opt/kds && npx tsx scripts/finance-cleanup.ts --yes"
 */
import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()
const EXECUTE = process.argv.includes('--yes')

// Bekannte Belegnummern-Kollision: kein echtes Duplikat, nur umbenennen statt löschen.
const RENAME_INSTEAD_OF_DELETE: Record<string, string> = {
  'E26043': 'E26043-PRIVATEINLAGE',
}

function fmtEur(n: number): string {
  return n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans) }))
}

async function main() {
  console.log('='.repeat(70))
  console.log(`FINANZ-BEREINIGUNG ${EXECUTE ? '(AUSFÜHRUNG)' : '(NUR VORSCHAU — kein --yes Flag gesetzt)'}`)
  console.log('='.repeat(70))

  const txAll = await prisma.transaction.findMany({ select: { referenceNumber: true } })
  const txRefSet = new Set(txAll.map(t => t.referenceNumber))

  const ftIncome = await prisma.financeTransaction.findMany({
    where: { type: 'INCOME' },
    select: { id: true, invoiceNumber: true, amount: true, description: true },
  })

  const toDelete: typeof ftIncome = []
  const toRename: typeof ftIncome = []

  for (const ft of ftIncome) {
    if (!ft.invoiceNumber || !txRefSet.has(ft.invoiceNumber)) continue
    if (RENAME_INSTEAD_OF_DELETE[ft.invoiceNumber]) {
      toRename.push(ft)
    } else {
      toDelete.push(ft)
    }
  }

  console.log(`\nZu löschen (echte Duplikate): ${toDelete.length}`)
  let sumDelete = 0
  for (const f of toDelete) {
    console.log(`  ${f.invoiceNumber?.padEnd(10)} ${fmtEur(Number(f.amount)).padEnd(12)} "${f.description}"`)
    sumDelete += Number(f.amount)
  }
  console.log(`  Summe: ${fmtEur(sumDelete)}`)

  console.log(`\nUmzubenennen (Belegnummern-Kollision, kein Duplikat): ${toRename.length}`)
  for (const f of toRename) {
    console.log(`  ${f.invoiceNumber} → ${RENAME_INSTEAD_OF_DELETE[f.invoiceNumber!]} (${fmtEur(Number(f.amount))}, "${f.description}")`)
  }

  if (toDelete.length === 0 && toRename.length === 0) {
    console.log('\n✅ Nichts zu tun.')
    return
  }

  if (!EXECUTE) {
    console.log('\n─────────────────────────────────────────────────')
    console.log('Das war nur eine Vorschau. Nichts wurde verändert.')
    console.log('Zum tatsächlichen Ausführen: Script mit --yes Flag erneut starten.')
    console.log('─────────────────────────────────────────────────')
    return
  }

  const answer = await ask(
    `\n⚠ ${toDelete.length} Zeilen werden UNWIDERRUFLICH gelöscht, ${toRename.length} umbenannt. Fortfahren? (ja/nein): `
  )
  if (answer.trim().toLowerCase() !== 'ja') {
    console.log('Abgebrochen, nichts verändert.')
    return
  }

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.financeTransaction.deleteMany({ where: { id: { in: toDelete.map(f => f.id) } } })
    }
    for (const f of toRename) {
      await tx.financeTransaction.update({
        where: { id: f.id },
        data: { invoiceNumber: RENAME_INSTEAD_OF_DELETE[f.invoiceNumber!] },
      })
    }
  })

  console.log(`\n✅ Erledigt: ${toDelete.length} gelöscht, ${toRename.length} umbenannt.`)
  console.log('Führe scripts/finance-diagnose.ts erneut aus, um das Ergebnis zu prüfen.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

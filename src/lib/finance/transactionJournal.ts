import { prisma } from '@/lib/prisma'

export interface JournalEntry {
  date: Date
  belegnummer: string
  direction: 'INCOME' | 'EXPENSE'
  patientLabel: string      // echter Name, Codename (KL-XXX) oder '—'
  description: string       // Leistungsbezeichnung(en) der Rechnung
  bezug: string | null      // z.B. "Storno zu RE-2026-0024" für klaren Rechnungsfluss
  category: string          // Kategorie-Code (für Gruppierung/BMD-Konto)
  netto: number
  ustSatz: number           // in % (0, 10, 20, ...)
  ustBetrag: number
  brutto: number
  paymentStatus: string
}

// Stellt sicher, dass alle übergebenen PatientInnen einen Codenamen (KL-XXX) haben.
// Vergibt fehlende Codenamen fortlaufend und persistiert sie, damit derselbe Patient
// bei jedem künftigen anonymisierten Export denselben Code erhält (Nachvollziehbarkeit).
async function ensureCodeNames(patientIds: string[]): Promise<void> {
  const missing = await prisma.patient.findMany({
    where: { id: { in: patientIds }, codeName: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (missing.length === 0) return

  const existing = await prisma.patient.findMany({
    where: { codeName: { not: null } },
    select: { codeName: true },
  })
  let maxN = 0
  for (const p of existing) {
    const m = /^KL-(\d+)$/.exec(p.codeName ?? '')
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10))
  }

  await prisma.$transaction(
    missing.map((p, i) =>
      prisma.patient.update({
        where: { id: p.id },
        data: { codeName: 'KL-' + String(maxN + i + 1).padStart(3, '0'), codeNameAuto: true },
      })
    )
  )
}

export async function computeTransactionJournal(
  userId: string, role: string, year: number, anonymize: boolean
): Promise<JournalEntry[]> {
  const dateRange = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) }
  const where: any = role === 'ADMIN' ? {} : { createdByUserId: userId }

  // Einzige Datenquelle für alle Geldbewegungen (Honorare, BMD-Import, manuelle
  // Buchungen). Das frühere Legacy-Modell FinanceTransaction wurde nach
  // erfolgreicher Migration + Verifikation entfernt (Belege waren zu 100%
  // bereits als Transaction dupliziert, siehe Git-Historie).
  const transactions = await prisma.transaction.findMany({
    where: { ...where, transactionDate: dateRange, lifecycleStatus: { in: ['ACTIVE'] } },
    select: {
      id: true, patientId: true, payerName: true, referenceNumber: true, transactionDate: true,
      direction: true, sourceType: true, category: true,
      amountNet: true, amountGross: true, vatRate: true, vatAmount: true,
      paymentStatus: true, cancelsTxId: true,
      patient: { select: { firstName: true, lastName: true, codeName: true } },
      lineItems: { select: { description: true, serviceLabel: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { transactionDate: 'asc' },
  })

  // Referenznummern aller (auch stornierten) Transaktionen für den Storno-Bezug auflösbar
  // machen — ohne diese selbst als eigene Journal-Zeile zu listen (sonst Doppelzählung).
  const cancelsIds = transactions.map(t => t.cancelsTxId).filter((x): x is string => !!x)
  const referencedOriginals = cancelsIds.length
    ? await prisma.transaction.findMany({ where: { id: { in: cancelsIds } }, select: { id: true, referenceNumber: true } })
    : []
  const refByTxId = new Map(referencedOriginals.map(t => [t.id, t.referenceNumber]))

  if (anonymize) {
    const idSet: { [k: string]: true } = {}
    for (const t of transactions) { if (t.patientId) idSet[t.patientId as string] = true }
    const ids: string[] = Object.keys(idSet)
    await ensureCodeNames(ids)
    // Codenamen frisch nachladen (ensureCodeNames hat ggf. welche neu vergeben)
    const refreshed = await prisma.patient.findMany({ where: { id: { in: ids } }, select: { id: true, codeName: true } })
    const codeMap = new Map(refreshed.map(p => [p.id, p.codeName]))
    for (const t of transactions) {
      if (t.patientId && t.patient) (t.patient as any).codeName = codeMap.get(t.patientId) ?? t.patient.codeName
    }
  }

  function patientLabel(patientId: string | null, patient: { firstName: string; lastName: string; codeName: string | null } | null, fallbackName: string): string {
    if (!patientId || !patient) return anonymize ? 'Manuelle Buchung' : fallbackName
    return anonymize ? (patient.codeName ?? 'KL-???') : `${patient.firstName} ${patient.lastName}`
  }

  const entries: JournalEntry[] = []

  for (const t of transactions) {
    const desc = t.lineItems.length > 0
      ? t.lineItems.map(li => li.serviceLabel ?? li.description).join('; ')
      : (t.sourceType === 'CANCELLATION' ? 'Storno Honorar' : t.sourceType === 'CORRECTION' ? 'Korrektur' : 'Honorar')
    const bezug = t.cancelsTxId ? `Storno zu ${refByTxId.get(t.cancelsTxId) ?? '—'}` : null
    entries.push({
      date: t.transactionDate,
      belegnummer: t.referenceNumber,
      direction: t.direction as 'INCOME' | 'EXPENSE',
      patientLabel: patientLabel(t.patientId, t.patient, t.payerName),
      description: desc,
      bezug,
      category: t.category ?? (t.direction === 'INCOME' ? 'HONORAR' : 'MISC_BUSINESS'),
      netto: Number(t.amountNet), ustSatz: Number(t.vatRate) * 100,
      ustBetrag: Number(t.vatAmount), brutto: Number(t.amountGross),
      paymentStatus: t.paymentStatus,
    })
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime())
  return entries
}

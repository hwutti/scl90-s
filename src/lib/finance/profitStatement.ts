import { prisma } from '@/lib/prisma'

export interface ProfitStatementResult {
  year: number
  income: { byCategory: Record<string, number>; total: number }
  ustSplit: { befreitNetto: number; pflichtigNetto: number; pflichtigUst: number; legacyOhneZuordnung: number }
  expenses: { byCategory: Record<string, number>; mileage: number; mileageKm: number; total: number }
  profit: number
  grundfreibetrag: number
  einkuenfte: number
  counts: { incomeTransactions: number; expenseTransactions: number; mileageEntries: number }
}

export async function computeProfitStatement(userId: string, role: string, year: number): Promise<ProfitStatementResult> {
  const dateRange = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) }
  const where: any = role === 'ADMIN' ? {} : { createdByUserId: userId }

  // Neue Transactions (Session-Transaktionen)
  const transactions = await prisma.transaction.findMany({
    where: { ...where, transactionDate: dateRange, lifecycleStatus: { in: ['ACTIVE'] } },
    select: {
      direction: true, amountNet: true, amountGross: true,
      vatRate: true, vatAmount: true, paymentStatus: true, sourceType: true,
    },
  })

  // Alte FinanceTransactions (Legacy, solange noch genutzt)
  const legacyTxs = await prisma.financeTransaction.findMany({
    where: { createdBy: userId, date: dateRange },
    select: { type: true, amount: true, incomeCategory: true, expenseCategory: true, paymentStatus: true },
  })

  // Fahrtenbuch
  const mileage = await prisma.mileageLog.findMany({
    where: { createdBy: userId, date: dateRange },
    select: { totalAmount: true, kilometers: true },
  })
  const totalMileage = mileage.reduce((s, m) => s + Number(m.totalAmount), 0)
  const totalKm = mileage.reduce((s, m) => s + Number(m.kilometers), 0)

  // ── Einnahmen aus neuen Transactions ─────────────────────────────────────
  const incomeTxList = transactions.filter(t => t.direction === 'INCOME')
  const incomeFromTx = incomeTxList.reduce((s, t) => s + Number(t.amountNet), 0)

  // USt-Aufteilung: Psychotherapeutische Behandlung ist gem. § 6 Abs 1 Z 19 UStG
  // unecht umsatzsteuerbefreit (vatRate = 0). Andere Leistungen (z.B. Supervision,
  // Coaching, Vorträge) sind USt-pflichtig und tragen eine vatRate > 0.
  const ustBefreitTx   = incomeTxList.filter(t => Number(t.vatRate) === 0)
  const ustPflichtigTx = incomeTxList.filter(t => Number(t.vatRate) > 0)
  const ustBefreitNetto   = ustBefreitTx.reduce((s, t) => s + Number(t.amountNet), 0)
  const ustPflichtigNetto = ustPflichtigTx.reduce((s, t) => s + Number(t.amountNet), 0)
  const ustPflichtigUst   = ustPflichtigTx.reduce((s, t) => s + Number(t.vatAmount), 0)

  // ── Ausgaben aus Legacy-Transaktionen nach Kategorie ─────────────────────
  const expenseCats: Record<string, number> = {}
  for (const t of legacyTxs.filter(t => t.type === 'EXPENSE')) {
    const cat = t.expenseCategory ?? 'MISC_BUSINESS'
    expenseCats[cat] = (expenseCats[cat] ?? 0) + Number(t.amount)
  }

  // ── Einnahmen aus Legacy nach Kategorie ──────────────────────────────────
  const incomeCats: Record<string, number> = {}
  const legacyIncome = legacyTxs.filter(t => t.type === 'INCOME')
  for (const t of legacyIncome) {
    const cat = t.incomeCategory ?? 'HONORAR'
    incomeCats[cat] = (incomeCats[cat] ?? 0) + Number(t.amount)
  }
  const legacyIncomeTotal = legacyIncome.reduce((s, t) => s + Number(t.amount), 0)
  incomeCats['HONORAR'] = (incomeCats['HONORAR'] ?? 0) + incomeFromTx

  const totalIncome = Object.values(incomeCats).reduce((s, v) => s + v, 0)
  const totalExpenses = Object.values(expenseCats).reduce((s, v) => s + v, 0) + totalMileage
  const profit = totalIncome - totalExpenses
  const grundfreibetrag = Math.max(0, profit) * 0.15
  const einkuenfte = Math.max(0, profit - grundfreibetrag)

  return {
    year,
    income: { byCategory: incomeCats, total: totalIncome },
    ustSplit: {
      befreitNetto: ustBefreitNetto,
      pflichtigNetto: ustPflichtigNetto,
      pflichtigUst: ustPflichtigUst,
      legacyOhneZuordnung: legacyIncomeTotal,
    },
    expenses: { byCategory: expenseCats, mileage: totalMileage, mileageKm: totalKm, total: totalExpenses },
    profit, grundfreibetrag, einkuenfte,
    counts: {
      incomeTransactions: transactions.filter(t => t.direction === 'INCOME').length,
      expenseTransactions: transactions.filter(t => t.direction === 'EXPENSE').length,
      mileageEntries: mileage.length,
    },
  }
}

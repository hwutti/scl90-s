import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/finance/profit-statement?year=2026
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())

  const dateRange = {
    gte: new Date(year, 0, 1),
    lte: new Date(year, 11, 31, 23, 59, 59),
  }

  const where: any = role === 'ADMIN' ? {} : { createdByUserId: userId }

  // Neue Transactions (Session-Transaktionen)
  const transactions = await prisma.transaction.findMany({
    where: {
      ...where,
      transactionDate: dateRange,
      lifecycleStatus: { in: ['ACTIVE'] },
    },
    select: {
      direction: true,
      amountNet: true,
      amountGross: true,
      vatAmount: true,
      paymentStatus: true,
      sourceType: true,
    },
  })

  // Alte FinanceTransactions (Legacy-Ausgaben, solange noch genutzt)
  const legacyTxs = await prisma.financeTransaction.findMany({
    where: { createdBy: userId, date: dateRange },
    select: {
      type: true,
      amount: true,
      incomeCategory: true,
      expenseCategory: true,
      paymentStatus: true,
    },
  })

  // Fahrtenbuch
  const mileage = await prisma.mileageLog.findMany({
    where: { createdBy: userId, date: dateRange },
    select: { totalAmount: true, kilometers: true },
  })
  const totalMileage = mileage.reduce((s, m) => s + Number(m.totalAmount), 0)
  const totalKm = mileage.reduce((s, m) => s + Number(m.kilometers), 0)

  // ── Einnahmen aus neuen Transactions ─────────────────────────────────────
  const incomeFromTx = transactions
    .filter(t => t.direction === 'INCOME')
    .reduce((s, t) => s + Number(t.amountNet), 0)

  // ── Ausgaben aus Legacy-Transaktionen nach Kategorie ─────────────────────
  const expenseCats: Record<string, number> = {}
  for (const t of legacyTxs.filter(t => t.type === 'EXPENSE')) {
    const cat = t.expenseCategory ?? 'MISC_BUSINESS'
    expenseCats[cat] = (expenseCats[cat] ?? 0) + Number(t.amount)
  }

  // ── Einnahmen aus Legacy nach Kategorie ──────────────────────────────────
  const incomeCats: Record<string, number> = {}
  for (const t of legacyTxs.filter(t => t.type === 'INCOME')) {
    const cat = t.incomeCategory ?? 'HONORAR'
    incomeCats[cat] = (incomeCats[cat] ?? 0) + Number(t.amount)
  }
  // Neue Session-Transaktionen als Honorare zählen
  incomeCats['HONORAR'] = (incomeCats['HONORAR'] ?? 0) + incomeFromTx

  const totalIncome = Object.values(incomeCats).reduce((s, v) => s + v, 0)
  const totalExpenses = Object.values(expenseCats).reduce((s, v) => s + v, 0) + totalMileage
  const profit = totalIncome - totalExpenses
  const grundfreibetrag = Math.max(0, profit) * 0.15
  const einkuenfte = Math.max(0, profit - grundfreibetrag)

  return NextResponse.json({
    year,
    income: {
      byCategory: incomeCats,
      total: totalIncome,
    },
    expenses: {
      byCategory: expenseCats,
      mileage: totalMileage,
      mileageKm: totalKm,
      total: totalExpenses,
    },
    profit,
    grundfreibetrag,
    einkuenfte,
    // Transaktions-Zählungen
    counts: {
      incomeTransactions: transactions.filter(t => t.direction === 'INCOME').length,
      expenseTransactions: transactions.filter(t => t.direction === 'EXPENSE').length,
      mileageEntries: mileage.length,
    },
  })
}

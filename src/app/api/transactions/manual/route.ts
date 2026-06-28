import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { reserveReferenceNumber } from '@/lib/services/transaction.service'

// POST /api/transactions/manual
// Erzeugt eine manuelle Transaktion (Einnahme oder Ausgabe)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const body = await req.json()

  const direction: 'INCOME' | 'EXPENSE' = body.direction ?? 'INCOME'
  const amountNet = parseFloat(body.amountNet ?? body.amount ?? 0)
  const vatRate = parseFloat(body.vatRate ?? 0)
  const vatAmount = amountNet * vatRate
  const amountGross = amountNet + vatAmount

  const referenceNumber = await reserveReferenceNumber({ direction })

  const tx = await prisma.transaction.create({
    data: {
      createdByUserId: userId,
      patientId: body.patientId ?? null,
      direction,
      sourceType: 'MANUAL',
      referenceNumber,
      transactionDate: new Date(body.transactionDate ?? new Date()),
      payerName: body.payerName ?? (direction === 'INCOME' ? 'Klient*in' : 'Ich'),
      payerAddress: body.payerAddress ?? null,
      payeeName: body.payeeName ?? (direction === 'INCOME' ? 'Praxis' : body.recipientName ?? 'Empfänger'),
      payeeAddress: body.payeeAddress ?? null,
      amountNet,
      vatRate,
      vatAmount,
      amountGross,
      paymentStatus: body.paid ? 'PAID' : 'UNPAID',
      paidAt: body.paid ? new Date(body.paidAt ?? new Date()) : null,
      paymentMethod: body.paid ? (body.paymentMethod ?? 'UNBAR_BANK_TRANSFER') : null,
      lifecycleStatus: 'ACTIVE',
      notes: body.notes ?? null,
    },
  })

  // AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'FINANCE_CREATED',
        details: { referenceNumber, direction, amountGross, manual: true },
      },
    })
  } catch (_) {}

  return NextResponse.json(tx, { status: 201 })
}

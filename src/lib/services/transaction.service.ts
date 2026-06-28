import { prisma } from '@/lib/prisma'
import { recalcSessionBillingStatus } from './session.service'

// ─── Referenznummer generieren ───────────────────────────────────────────────

export async function reserveReferenceNumber(params: {
  direction: 'INCOME' | 'EXPENSE'
  format?: string
}): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = params.direction === 'INCOME' ? 'RE' : 'AU'
  const format = params.format ?? `${prefix}-${year}-`

  // Letzte Sequenznummer für dieses Jahr und Richtung
  const last = await prisma.referenceNumberLedger.findFirst({
    where: { referenceYear: year, direction: params.direction as any, releasedAt: null },
    orderBy: { sequenceNumber: 'desc' },
  })

  const nextSeq = (last?.sequenceNumber ?? 0) + 1
  const referenceNumber = `${format}${String(nextSeq).padStart(4, '0')}`

  await prisma.referenceNumberLedger.create({
    data: {
      referenceNumber,
      sequenceNumber: nextSeq,
      referenceYear: year,
      direction: params.direction as any,
      formatUsed: format,
    },
  })

  return referenceNumber
}

// ─── Transaktion aus Sessions erstellen ──────────────────────────────────────

export async function createTransactionFromSessions(params: {
  sessionIds: string[]
  patientId: string
  payerName: string
  payerAddress?: string
  payeeName: string
  payeeAddress?: string
  vatRate?: number
  markAsPaid?: boolean
  paymentMethod?: string
  notes?: string
  createdByUserId: string
  serviceLabel?: string
}): Promise<{ transactionId: string; referenceNumber: string }> {

  return await prisma.$transaction(async (tx) => {
    // 1. Sessions laden und validieren
    const sessions = await tx.therapySession.findMany({
      where: { id: { in: params.sessionIds } },
    })

    if (sessions.length !== params.sessionIds.length)
      throw new Error('Nicht alle Sessions gefunden')

    for (const s of sessions) {
      if (s.patientId !== params.patientId)
        throw new Error(`Session ${s.id} gehört nicht zum Patienten`)
      if (s.excludedFromFinances)
        throw new Error(`Session ${s.id} ist von Finanzen ausgeschlossen`)
      if (s.billingStatus === 'PAID')
        throw new Error(`Session ${s.id} ist bereits vollständig verrechnet`)
    }

    // 2. Beträge berechnen
    const amountNet = sessions.reduce((sum, s) =>
      sum + parseFloat(s.calculatedPriceNet?.toString() ?? '0'), 0)
    const vatRate = params.vatRate ?? 0
    const vatAmount = amountNet * vatRate
    const amountGross = amountNet + vatAmount

    // 3. Referenznummer reservieren
    const referenceNumber = await reserveReferenceNumber({ direction: 'INCOME' })
    const now = new Date()

    // 4. Transaktion erstellen
    const transaction = await tx.transaction.create({
      data: {
        patientId: params.patientId,
        createdByUserId: params.createdByUserId,
        direction: 'INCOME',
        sourceType: 'SESSION',
        referenceNumber,
        transactionDate: now,
        payerName: params.payerName,
        payerAddress: params.payerAddress,
        payeeName: params.payeeName,
        payeeAddress: params.payeeAddress,
        amountNet,
        vatRate,
        vatAmount,
        amountGross,
        paymentStatus: params.markAsPaid ? 'PAID' : 'UNPAID',
        paidAt: params.markAsPaid ? now : null,
        paymentMethod: params.markAsPaid ? (params.paymentMethod as any ?? 'UNBAR_BANK_TRANSFER') : null,
        paymentUndoDeadline: params.markAsPaid ? new Date(now.getTime() + 5 * 60 * 1000) : null,
        lifecycleStatus: 'ACTIVE',
        notes: params.notes,
      },
    })

    // 5. LineItems und Allocations erstellen
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]
      const lineAmountNet = parseFloat(s.calculatedPriceNet?.toString() ?? '0')
      const lineVatAmount = lineAmountNet * vatRate
      const lineAmountGross = lineAmountNet + lineVatAmount

      const lineItem = await tx.txLineItem.create({
        data: {
          transactionId: transaction.id,
          sessionId: s.id,
          description: s.name,
          serviceLabel: s.serviceLabel ?? params.serviceLabel,
          quantity: 1,
          unitPriceNet: lineAmountNet,
          amountNet: lineAmountNet,
          vatRate,
          vatAmount: lineVatAmount,
          amountGross: lineAmountGross,
          lineDate: s.sessionDate,
          sortOrder: i,
        },
      })

      await tx.txSessionAllocation.create({
        data: {
          transactionId: transaction.id,
          lineItemId: lineItem.id,
          sessionId: s.id,
          allocationPercentage: 1.0,
          allocatedAmountNet: lineAmountNet,
          allocatedVatAmount: lineVatAmount,
          allocatedAmountGross: lineAmountGross,
          isActive: true,
        },
      })
    }

    // 6. Timeline
    await tx.profileTimelineEvent.create({
      data: {
        patientId: params.patientId,
        eventType: 'transaction_created',
        relatedEntityType: 'transaction',
        relatedEntityId: transaction.id,
        title: `Transaktion ${referenceNumber} erstellt`,
        summary: `${sessions.length} Session(s) · € ${amountGross.toFixed(2)}`,
        eventDate: now,
        createdByUserId: params.createdByUserId,
      },
    })

    return { transactionId: transaction.id, referenceNumber }
  }).then(async (result) => {
    // Billing-Status neu berechnen (außerhalb Transaktion)
    for (const id of params.sessionIds) {
      await recalcSessionBillingStatus(id)
    }
    return result
  })
}

// ─── Zahlung markieren ───────────────────────────────────────────────────────

export async function markTransactionPaid(params: {
  transactionId: string
  paymentMethod: string
  paidAt?: Date
}): Promise<void> {
  const now = params.paidAt ?? new Date()
  const deadline = new Date(now.getTime() + 5 * 60 * 1000)

  const tx = await prisma.transaction.update({
    where: { id: params.transactionId },
    data: {
      paymentStatus: 'PAID',
      paidAt: now,
      paymentMethod: params.paymentMethod as any,
      paymentUndoDeadline: deadline,
    },
    include: { sessionAllocations: { select: { sessionId: true } } },
  })

  // Session-Status neu berechnen
  const sessionIds = [...new Set(tx.sessionAllocations.map(a => a.sessionId))]
  for (const id of sessionIds) {
    await recalcSessionBillingStatus(id)
  }
}

// ─── Zahlung rückgängig (innerhalb 5 Minuten) ────────────────────────────────

export async function undoPayment(transactionId: string): Promise<void> {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { sessionAllocations: { select: { sessionId: true } } },
  })

  if (!tx) throw new Error('Transaktion nicht gefunden')
  if (tx.paymentStatus !== 'PAID') throw new Error('Transaktion ist nicht bezahlt')
  if (!tx.paymentUndoDeadline || new Date() > tx.paymentUndoDeadline)
    throw new Error('5-Minuten-Frist abgelaufen. Bitte Storno verwenden.')

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { paymentStatus: 'UNPAID', paidAt: null, paymentMethod: null, paymentUndoDeadline: null },
  })

  const sessionIds = [...new Set(tx.sessionAllocations.map(a => a.sessionId))]
  for (const id of sessionIds) await recalcSessionBillingStatus(id)
}

// ─── Transaktion stornieren ──────────────────────────────────────────────────

export async function cancelTransaction(params: {
  transactionId: string
  cancelledByUserId: string
}): Promise<{ cancellationTxId: string; referenceNumber: string }> {

  return await prisma.$transaction(async (tx) => {
    const original = await tx.transaction.findUnique({
      where: { id: params.transactionId },
      include: {
        sessionAllocations: { where: { isActive: true }, select: { id: true, sessionId: true } },
        lineItems: true,
      },
    })

    if (!original) throw new Error('Transaktion nicht gefunden')
    if (original.lifecycleStatus !== 'ACTIVE') throw new Error('Transaktion ist nicht aktiv')
    if (original.cancelledByTxId) throw new Error('Transaktion wurde bereits storniert')

    // Neue Referenznummer für Storno
    const refNum = await reserveReferenceNumber({ direction: original.direction as any })
    const now = new Date()

    // Stornotransaktion (negative Beträge)
    const cancellation = await tx.transaction.create({
      data: {
        patientId: original.patientId,
        createdByUserId: params.cancelledByUserId,
        direction: original.direction,
        sourceType: 'CANCELLATION',
        referenceNumber: refNum,
        transactionDate: now,
        payerName: original.payerName,
        payerAddress: original.payerAddress,
        payeeName: original.payeeName,
        payeeAddress: original.payeeAddress,
        amountNet:    parseFloat(original.amountNet.toString()) * -1,
        vatRate:      original.vatRate,
        vatAmount:    parseFloat(original.vatAmount.toString()) * -1,
        amountGross:  parseFloat(original.amountGross.toString()) * -1,
        paymentStatus: 'PAID',
        paidAt: now,
        lifecycleStatus: 'CANCELLATION_TX',
        cancelsTxId: original.id,
        notes: `Storno zu ${original.referenceNumber}`,
      },
    })

    // Original als storniert markieren
    await tx.transaction.update({
      where: { id: original.id },
      data: { lifecycleStatus: 'CANCELLED_ORIGINAL', cancelledByTxId: cancellation.id },
    })

    // Allocations deaktivieren
    await tx.txSessionAllocation.updateMany({
      where: { transactionId: original.id },
      data: { isActive: false, deactivatedAt: now, deactivationReason: 'storniert' },
    })

    // Timeline
    if (original.patientId) {
      await tx.profileTimelineEvent.create({
        data: {
          patientId: original.patientId,
          eventType: 'transaction_cancelled',
          relatedEntityType: 'transaction',
          relatedEntityId: cancellation.id,
          title: `Storno ${refNum}`,
          summary: `Storno zu ${original.referenceNumber}`,
          eventDate: now,
          createdByUserId: params.cancelledByUserId,
        },
      })
    }

    return { cancellationTxId: cancellation.id, referenceNumber: refNum }
  }).then(async (result) => {
    // Sessions wieder freigeben
    const original = await prisma.transaction.findUnique({
      where: { id: params.transactionId },
      include: { sessionAllocations: { select: { sessionId: true } } },
    })
    if (original) {
      for (const a of original.sessionAllocations) {
        await recalcSessionBillingStatus(a.sessionId)
      }
    }
    return result
  })
}

import { prisma } from '@/lib/prisma'
import { recalcSessionBillingStatus } from './session.service'
import { renderInvoiceHtmlForTransaction } from '@/lib/invoice/template'

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
  generateInvoiceDoc?: boolean
  anonymizeInvoice?: boolean
  invoiceTemplateId?: string | null
}): Promise<{ transactionId: string; referenceNumber: string; invoiceHtml?: string }> {

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

    // 2. Zusatzleistungen je Sitzung laden (bisher komplett ignoriert -> Bug:
    //    unter der Sitzung erfasste Zusatzleistungen tauchten nie in der Rechnung auf)
    const serviceLines = await tx.sessionServiceLine.findMany({
      where: { sessionId: { in: params.sessionIds } },
      orderBy: [{ sessionId: 'asc' }, { sortOrder: 'asc' }],
    })
    const serviceLinesBySession = new Map<string, typeof serviceLines>()
    for (const line of serviceLines) {
      const list = serviceLinesBySession.get(line.sessionId) ?? []
      list.push(line)
      serviceLinesBySession.set(line.sessionId, list)
    }

    // 3. Beträge berechnen (Sitzungs-Basispreise + Zusatzleistungen)
    const sessionAmountNet = sessions.reduce((sum, s) =>
      sum + parseFloat(s.calculatedPriceNet?.toString() ?? '0'), 0)
    const serviceLinesAmountNet = serviceLines.reduce((sum, l) =>
      sum + parseFloat(l.amountNet?.toString() ?? '0'), 0)
    const amountNet = sessionAmountNet + serviceLinesAmountNet
    const vatRate = params.vatRate ?? 0
    const vatAmount = amountNet * vatRate
    const amountGross = amountNet + vatAmount

    // 4. Referenznummer reservieren
    const referenceNumber = await reserveReferenceNumber({ direction: 'INCOME' })
    const now = new Date()

    // 5. Transaktion erstellen
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
        invoiceTemplateId: params.invoiceTemplateId || null,
      },
    })

    // 6. LineItems und Allocations erstellen (Basispreis + Zusatzleistungen je Sitzung)
    let sortOrder = 0
    for (const s of sessions) {
      const lineAmountNet = parseFloat(s.calculatedPriceNet?.toString() ?? '0')
      const lineVatAmount = lineAmountNet * vatRate
      const lineAmountGross = lineAmountNet + lineVatAmount

      const lineItem = await tx.txLineItem.create({
        data: {
          transactionId: transaction.id,
          sessionId: s.id,
          // "Sitzung-N" statt vollem Session-Namen (der bereits das Datum enthält,
          // das aber schon in der eigenen Datum-Spalte der Rechnung steht)
          description: `Sitzung-${s.sessionNumber}`,
          serviceLabel: s.serviceLabel ?? params.serviceLabel,
          quantity: 1,
          unitPriceNet: lineAmountNet,
          amountNet: lineAmountNet,
          vatRate,
          vatAmount: lineVatAmount,
          amountGross: lineAmountGross,
          lineDate: s.sessionDate,
          sortOrder: sortOrder++,
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

      // Zusatzleistungen dieser Sitzung als eigene Rechnungspositionen übernehmen
      // (eigener vatRate je Zeile beibehalten statt dem Sitzungs-vatRate zu erzwingen)
      for (const line of serviceLinesBySession.get(s.id) ?? []) {
        const lAmountNet = parseFloat(line.amountNet.toString())
        const lVatRate = parseFloat(line.vatRate.toString())
        const lVatAmount = lAmountNet * lVatRate
        const lAmountGross = lAmountNet + lVatAmount

        const extraLineItem = await tx.txLineItem.create({
          data: {
            transactionId: transaction.id,
            sessionId: s.id,
            description: line.description,
            serviceLabel: line.catalogCode ?? undefined,
            quantity: line.quantity,
            unitPriceNet: line.unitPriceNet,
            amountNet: lAmountNet,
            vatRate: lVatRate,
            vatAmount: lVatAmount,
            amountGross: lAmountGross,
            lineDate: s.sessionDate,
            sortOrder: sortOrder++,
          },
        })

        await tx.txSessionAllocation.create({
          data: {
            transactionId: transaction.id,
            lineItemId: extraLineItem.id,
            sessionId: s.id,
            allocationPercentage: 1.0,
            allocatedAmountNet: lAmountNet,
            allocatedVatAmount: lVatAmount,
            allocatedAmountGross: lAmountGross,
            isActive: true,
          },
        })
      }
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

    // InvoiceDocument anlegen wenn gewünscht - sofort vollständig gerendert
    // (vorher wurde hier nur eine leere Zeile ohne Inhalt angelegt, dadurch ging
    // sowohl die gewählte Vorlage als auch jede Vorschau verloren)
    let invoiceHtml: string | undefined
    if (params.generateInvoiceDoc !== false) {
      try {
        invoiceHtml = await renderInvoiceHtmlForTransaction(result.transactionId)
        await prisma.invoiceDocument.create({
          data: {
            transactionId: result.transactionId,
            documentType: 'INVOICE_PDF',
            format: 'html',
            anonymized: params.anonymizeInvoice ?? false,
            data: Buffer.from(invoiceHtml, 'utf8'),
            mimeType: 'text/html',
          },
        })
      } catch (e) {
        console.error('[invoice] Sofort-Generierung fehlgeschlagen:', e)
        /* nicht kritisch - Dokument wird beim ersten Anzeigen/Drucken nachträglich erzeugt */
      }
    }

    return { ...result, invoiceHtml }
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

  // Sitzungs-Status neu berechnen
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

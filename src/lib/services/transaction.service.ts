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
  // Manuelle Überschreibungen einzelner Positionen aus der Abrechnen-Ansicht.
  // Key: "session:<sessionId>" für die Sitzungs-Grundposition,
  //      "service:<sessionServiceLineId>" für Zusatzleistungen
  lineItemOverrides?: Record<string, {
    description?: string
    descriptionHtml?: string
    quantity?: number
    unitPriceNet?: number
    serviceLabel?: string
  }>
  // Freitext, der unter den Positionen auf der Honorarnote erscheint
  customNoteHtml?: string
  // Keys ("session:<id>" / "service:<id>") von automatisch generierten Positionen,
  // die der Nutzer in der Abrechnen-Ansicht explizit gelöscht hat -- die Sitzung
  // selbst bleibt trotzdem korrekt verbucht, nur diese Position entfällt.
  removedLineKeys?: string[]
  // Frei hinzugefügte Positionen ohne Sitzungsbezug (z.B. Sonderleistungen),
  // direkt in der Abrechnen-Ansicht per "+ Position hinzufügen" erstellt
  manualLines?: {
    description?: string
    descriptionHtml?: string
    quantity?: number
    unitPriceNet?: number
    lineDate?: string | null
  }[]
}): Promise<{ transactionId: string; referenceNumber: string; invoiceHtml?: string }> {

  return await prisma.$transaction(async (tx) => {
    // 0. Kooperationspartner-Patienten dürfen nicht über den normalen
    // Patienten-Flow abgerechnet werden -- die Abrechnung läuft gesammelt
    // über createPartnerTransaction() (siehe /kooperationspartner/[id]/rechnung/neu).
    const patientCheck = await tx.patient.findUnique({
      where: { id: params.patientId },
      select: { cooperationPartnerId: true },
    })
    if (patientCheck?.cooperationPartnerId) {
      throw new Error('Dieser Patient gehört zu einem Kooperationspartner. Abrechnung bitte über den Kooperationspartner vornehmen.')
    }

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

    // 3. Positionen auflösen (Sitzungs-Basispreise + Zusatzleistungen), dabei
    //    manuelle Überschreibungen aus der Abrechnen-Ansicht anwenden falls vorhanden
    const vatRate = params.vatRate ?? 0
    const overrides = params.lineItemOverrides ?? {}
    const removedKeys = new Set(params.removedLineKeys ?? [])

    interface ResolvedLine {
      sessionId: string | null
      description: string
      descriptionHtml: string | null
      serviceLabel?: string | null
      quantity: number
      unitPriceNet: number
      vatRate: number
      lineDate: Date
    }
    const resolvedLines: ResolvedLine[] = []

    for (const s of sessions) {
      const baseKey = `session:${s.id}`
      const baseOverride = overrides[baseKey]
      if (!removedKeys.has(baseKey)) {
        resolvedLines.push({
          sessionId: s.id,
          // "Sitzung-N" statt vollem Session-Namen (der bereits das Datum enthält,
          // das aber schon in der eigenen Datum-Spalte der Rechnung steht)
          description: baseOverride?.description ?? `Sitzung-${s.sessionNumber}`,
          descriptionHtml: baseOverride?.descriptionHtml ?? null,
          serviceLabel: baseOverride?.serviceLabel !== undefined ? baseOverride.serviceLabel : (s.serviceLabel ?? params.serviceLabel),
          quantity: baseOverride?.quantity ?? 1,
          unitPriceNet: baseOverride?.unitPriceNet ?? parseFloat(s.calculatedPriceNet?.toString() ?? '0'),
          vatRate,
          lineDate: s.sessionDate,
        })
      }

      // Zusatzleistungen dieser Sitzung als eigene Rechnungspositionen übernehmen
      // (eigener vatRate je Zeile beibehalten statt dem Sitzungs-vatRate zu erzwingen)
      for (const line of serviceLinesBySession.get(s.id) ?? []) {
        const lineKey = `service:${line.id}`
        if (removedKeys.has(lineKey)) continue
        const lineOverride = overrides[lineKey]
        resolvedLines.push({
          sessionId: s.id,
          description: lineOverride?.description ?? line.description,
          descriptionHtml: lineOverride?.descriptionHtml ?? null,
          serviceLabel: lineOverride?.serviceLabel !== undefined ? lineOverride.serviceLabel : (line.catalogCode ?? undefined),
          quantity: lineOverride?.quantity ?? parseFloat(line.quantity.toString()),
          unitPriceNet: lineOverride?.unitPriceNet ?? parseFloat(line.unitPriceNet.toString()),
          vatRate: parseFloat(line.vatRate.toString()),
          lineDate: s.sessionDate,
        })
      }
    }

    // Frei hinzugefügte Positionen ohne Sitzungsbezug (kein sessionId -> keine
    // TxSessionAllocation, analog zu createPartnerTransaction)
    const nowForManualLines = new Date()
    for (const ml of params.manualLines ?? []) {
      resolvedLines.push({
        sessionId: null,
        description: ml.description?.trim() || 'Position',
        descriptionHtml: ml.descriptionHtml ?? null,
        serviceLabel: null,
        quantity: ml.quantity ?? 1,
        unitPriceNet: ml.unitPriceNet ?? 0,
        vatRate,
        lineDate: ml.lineDate ? new Date(ml.lineDate) : nowForManualLines,
      })
    }

    if (resolvedLines.length === 0) {
      throw new Error('Mindestens eine Rechnungsposition erforderlich (alle Positionen wurden entfernt)')
    }

    const amountNet = resolvedLines.reduce((sum, l) => sum + l.quantity * l.unitPriceNet, 0)
    const vatAmount = resolvedLines.reduce((sum, l) => sum + l.quantity * l.unitPriceNet * l.vatRate, 0)
    const amountGross = amountNet + vatAmount

    // 4. Referenznummer reservieren
    const referenceNumber = await reserveReferenceNumber({ direction: 'INCOME' })
    const now = nowForManualLines

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
        customNoteHtml: params.customNoteHtml || null,
        invoiceTemplateId: params.invoiceTemplateId || null,
      },
    })

    // 6. LineItems und Allocations erstellen (Basispreis + Zusatzleistungen je Sitzung)
    let sortOrder = 0
    for (const line of resolvedLines) {
      const lineAmountNet = line.quantity * line.unitPriceNet
      const lineVatAmount = lineAmountNet * line.vatRate
      const lineAmountGross = lineAmountNet + lineVatAmount

      const lineItem = await tx.txLineItem.create({
        data: {
          transactionId: transaction.id,
          sessionId: line.sessionId,
          description: line.description,
          descriptionHtml: line.descriptionHtml,
          serviceLabel: line.serviceLabel,
          quantity: line.quantity,
          unitPriceNet: line.unitPriceNet,
          amountNet: lineAmountNet,
          vatRate: line.vatRate,
          vatAmount: lineVatAmount,
          amountGross: lineAmountGross,
          lineDate: line.lineDate,
          sortOrder: sortOrder++,
        },
      })

      if (line.sessionId) {
        await tx.txSessionAllocation.create({
          data: {
            transactionId: transaction.id,
            lineItemId: lineItem.id,
            sessionId: line.sessionId,
            allocationPercentage: 1.0,
            allocatedAmountNet: lineAmountNet,
            allocatedVatAmount: lineVatAmount,
            allocatedAmountGross: lineAmountGross,
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

// ─── Transaktion für Kooperationspartner erstellen (frei editierbare Positionen) ──
// Anders als createTransactionFromSessions: die Positionen werden NICHT starr aus
// Sitzungspreisen abgeleitet, sondern kommen fertig editiert vom Aufrufer (siehe
// KooperationspartnerRechnungClient.tsx). Jede Position kann optional eine
// sessionId tragen (Sitzung wird dadurch korrekt als "verrechnet" markiert),
// muss es aber nicht -- frei hinzugefügte Positionen ohne Sitzungsbezug fließen
// nur in die Rechnungssumme ein, nicht in irgendeine Sitzungs-Abrechnungsstatistik.
export async function createPartnerTransaction(params: {
  cooperationPartnerId: string
  payerName: string
  payerAddress?: string
  payeeName: string
  payeeAddress?: string
  vatRate?: number
  markAsPaid?: boolean
  paymentMethod?: string
  notes?: string
  createdByUserId: string
  generateInvoiceDoc?: boolean
  anonymizeInvoice?: boolean
  invoiceTemplateId?: string | null
  lineItems: {
    description: string
    quantity: number
    unitPriceNet: number
    vatRate?: number
    sessionId?: string | null
    lineDate?: string | null
  }[]
}): Promise<{ transactionId: string; referenceNumber: string; invoiceHtml?: string }> {

  if (!params.lineItems || params.lineItems.length === 0) {
    throw new Error('Mindestens eine Rechnungsposition erforderlich')
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Sitzungen, die über eine sessionId referenziert werden, validieren --
    //    müssen zu einem Patienten DIESES Partners gehören und dürfen noch nicht
    //    voll bezahlt sein (gleiche Regeln wie bei der normalen Patienten-Rechnung).
    const sessionIds = [...new Set(params.lineItems.map(l => l.sessionId).filter(Boolean))] as string[]
    if (sessionIds.length > 0) {
      const sessions = await tx.therapySession.findMany({
        where: { id: { in: sessionIds } },
        include: { patient: { select: { cooperationPartnerId: true } } },
      })
      if (sessions.length !== sessionIds.length)
        throw new Error('Nicht alle referenzierten Sitzungen gefunden')
      for (const s of sessions) {
        if ((s.patient as any)?.cooperationPartnerId !== params.cooperationPartnerId)
          throw new Error(`Sitzung ${s.id} gehört nicht zu einem Patienten dieses Kooperationspartners`)
        if (s.excludedFromFinances)
          throw new Error(`Sitzung ${s.id} ist von Finanzen ausgeschlossen`)
        if (s.billingStatus === 'PAID')
          throw new Error(`Sitzung ${s.id} ist bereits vollständig verrechnet`)
      }
    }

    // 2. Beträge berechnen (jede Zeile mit eigenem vatRate, Standard = Transaktions-vatRate)
    const defaultVatRate = params.vatRate ?? 0
    const computedLines = params.lineItems.map(l => {
      const amountNet = l.quantity * l.unitPriceNet
      const lineVatRate = l.vatRate ?? defaultVatRate
      const vatAmount = amountNet * lineVatRate
      return { ...l, amountNet, vatRate: lineVatRate, vatAmount, amountGross: amountNet + vatAmount }
    })
    const amountNet = computedLines.reduce((s, l) => s + l.amountNet, 0)
    const vatAmount = computedLines.reduce((s, l) => s + l.vatAmount, 0)
    const amountGross = amountNet + vatAmount

    // 3. Referenznummer reservieren
    const referenceNumber = await reserveReferenceNumber({ direction: 'INCOME' })
    const now = new Date()

    // 4. Transaktion erstellen (patientId bewusst leer -- kann mehrere Patienten umfassen)
    const transaction = await tx.transaction.create({
      data: {
        cooperationPartnerId: params.cooperationPartnerId,
        createdByUserId: params.createdByUserId,
        direction: 'INCOME',
        sourceType: sessionIds.length > 0 ? 'SESSION' : 'MANUAL',
        referenceNumber,
        transactionDate: now,
        payerName: params.payerName,
        payerAddress: params.payerAddress,
        payeeName: params.payeeName,
        payeeAddress: params.payeeAddress,
        amountNet,
        vatRate: defaultVatRate,
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

    // 5. LineItems + Allocations (nur für Zeilen mit sessionId)
    for (let i = 0; i < computedLines.length; i++) {
      const l = computedLines[i]
      const lineItem = await tx.txLineItem.create({
        data: {
          transactionId: transaction.id,
          sessionId: l.sessionId || null,
          description: l.description,
          quantity: l.quantity,
          unitPriceNet: l.unitPriceNet,
          amountNet: l.amountNet,
          vatRate: l.vatRate,
          vatAmount: l.vatAmount,
          amountGross: l.amountGross,
          lineDate: l.lineDate ? new Date(l.lineDate) : null,
          sortOrder: i,
        },
      })

      if (l.sessionId) {
        await tx.txSessionAllocation.create({
          data: {
            transactionId: transaction.id,
            lineItemId: lineItem.id,
            sessionId: l.sessionId,
            allocationPercentage: 1.0,
            allocatedAmountNet: l.amountNet,
            allocatedVatAmount: l.vatAmount,
            allocatedAmountGross: l.amountGross,
            isActive: true,
          },
        })
      }
    }

    return { transactionId: transaction.id, referenceNumber, sessionIds }
  }).then(async (result) => {
    for (const id of result.sessionIds) {
      await recalcSessionBillingStatus(id)
    }

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
        console.error('[invoice] Sofort-Generierung fehlgeschlagen (Partner):', e)
      }
    }

    return { transactionId: result.transactionId, referenceNumber: result.referenceNumber, invoiceHtml }
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
        cooperationPartnerId: (original as any).cooperationPartnerId,
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

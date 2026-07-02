import { prisma } from '@/lib/prisma'
import { parseDunningSettings, DUNNING_LEVEL_ORDER } from '@/lib/finance/dunningSettings'
import { buildAccessibleTransactionWhere } from '@/lib/access'

export interface DunningSuggestion {
  transactionId: string
  referenceNumber: string
  patientId: string | null
  patientName: string
  patientEmail: string | null
  amountGross: number
  transactionDate: Date
  dueDate: Date
  daysOverdue: number
  lastLevel: string | null
  lastSentAt: Date | null
  nextLevel: string | null     // naechste Stufe, oder null wenn bereits Hoechststufe erreicht
  readyForAction: boolean      // Frist fuer naechste Stufe ist erreicht
  daysUntilNext: number | null // falls noch nicht so weit
  maxLevelReached: boolean
  history: { level: string; sentAt: Date }[]
}

const DAY_MS = 24 * 3600 * 1000

export async function computeDunningSuggestions(userId: string, role: string): Promise<DunningSuggestion[]> {
  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  const settings = parseDunningSettings(config?.dunningSettings)
  const where: any = await buildAccessibleTransactionWhere(userId, role)

  const transactions = await prisma.transaction.findMany({
    where: { ...where, direction: 'INCOME', lifecycleStatus: 'ACTIVE', paymentStatus: 'UNPAID' },
    select: {
      id: true, referenceNumber: true, patientId: true, payerName: true, transactionDate: true,
      amountGross: true, invoiceTemplateId: true,
      patient: { select: { email: true, defaultInvoiceTemplateId: true } },
      dunnings: { select: { level: true, sentAt: true }, orderBy: { sentAt: 'desc' } },
    },
    orderBy: { transactionDate: 'asc' },
  })

  // paymentDays je Vorlage einmalig laden (vermeidet N+1)
  const templates = await prisma.invoiceTemplate.findMany({ select: { id: true, paymentDays: true } })
  const paymentDaysById = new Map(templates.map(t => [t.id, t.paymentDays]))

  const now = Date.now()
  const result: DunningSuggestion[] = []

  for (const tx of transactions) {
    const templateId = tx.invoiceTemplateId ?? tx.patient?.defaultInvoiceTemplateId ?? null
    const paymentDays: number = (templateId ? (paymentDaysById.get(templateId) as number | undefined) : undefined) ?? 14
    const dueDate = new Date(tx.transactionDate.getTime() + paymentDays * DAY_MS)
    if (now <= dueDate.getTime()) continue // noch gar nicht ueberfaellig

    const daysOverdue = Math.floor((now - dueDate.getTime()) / DAY_MS)

    const sentLevels = tx.dunnings.map(d => d.level)
    let lastLevel: string | null = null
    let lastSentAt: Date | null = null
    for (const lvl of DUNNING_LEVEL_ORDER) {
      const sent = tx.dunnings.find(d => d.level === lvl)
      if (sent) { lastLevel = lvl; lastSentAt = sent.sentAt }
    }

    const currentIdx = lastLevel ? DUNNING_LEVEL_ORDER.indexOf(lastLevel as any) : -1
    const maxLevelReached = currentIdx === DUNNING_LEVEL_ORDER.length - 1
    const nextLevel = maxLevelReached ? null : DUNNING_LEVEL_ORDER[currentIdx + 1]

    let readyForAction = false
    let daysUntilNext: number | null = null
    if (nextLevel) {
      const waitDays = nextLevel === 'ERINNERUNG' ? settings.erinnerungDays
        : nextLevel === 'MAHNUNG_1' ? settings.mahnung1Days
        : settings.mahnung2Days
      const anchorTime = lastSentAt ? lastSentAt.getTime() : dueDate.getTime()
      const readyAt = anchorTime + waitDays * DAY_MS
      readyForAction = now >= readyAt
      daysUntilNext = readyForAction ? 0 : Math.ceil((readyAt - now) / DAY_MS)
    }

    result.push({
      transactionId: tx.id, referenceNumber: tx.referenceNumber,
      patientId: tx.patientId, patientName: tx.payerName, patientEmail: tx.patient?.email ?? null,
      amountGross: Number(tx.amountGross), transactionDate: tx.transactionDate, dueDate, daysOverdue,
      lastLevel, lastSentAt, nextLevel, readyForAction, daysUntilNext, maxLevelReached,
      history: tx.dunnings.slice().reverse().map(d => ({ level: d.level, sentAt: d.sentAt })),
    })
  }

  // Dringendste zuerst: actionable vor nicht-actionable, dann nach Tagen ueberfaellig
  result.sort((a, b) => (Number(b.readyForAction) - Number(a.readyForAction)) || (b.daysOverdue - a.daysOverdue))
  return result
}

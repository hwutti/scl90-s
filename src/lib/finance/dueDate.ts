import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 3600 * 1000

// Gleiche Vorlagen-Prioritaet wie beim Rechnungs-Rendering:
// 1. explizit gewaehlte Vorlage (Transaction.invoiceTemplateId), 2. Patient-Standard, 3. Fallback 14 Tage.
export async function resolveDueDate(
  transactionDate: Date,
  invoiceTemplateId: string | null,
  patientDefaultTemplateId: string | null | undefined
): Promise<Date> {
  const templateId = invoiceTemplateId ?? patientDefaultTemplateId ?? null
  let paymentDays = 14
  if (templateId) {
    const tmpl = await prisma.invoiceTemplate.findUnique({ where: { id: templateId }, select: { paymentDays: true } })
    if (tmpl) paymentDays = tmpl.paymentDays
  }
  return new Date(transactionDate.getTime() + paymentDays * DAY_MS)
}

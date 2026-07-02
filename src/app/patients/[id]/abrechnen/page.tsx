import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { getBranding } from '@/lib/branding'
import { AbrechnenClient } from './AbrechnenClient'

export default async function AbrechnenPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { sessions?: string; draftId?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) redirect('/my')

  if (role === 'THERAPIST') {
    const rel = await prisma.therapistPatient.findUnique({
      where: { therapistId_patientId: { therapistId: userId, patientId: params.id } },
    })
    if (!rel) redirect('/patients')
  }

  const patient = await prisma.patient.findUnique({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, gender: true,
      billRecipientName: true, billRecipientAddress: true, billRecipientCity: true,
      defaultVatRate: true, defaultPaymentMethod: true, defaultMarkAsPaid: true,
      defaultInvoiceTemplateId: true,
      defaultBillingMode: true,
    },
  })
  if (!patient) notFound()

  // Ausgewählte Session-IDs aus URL
  const sessionIds = searchParams.sessions
    ? searchParams.sessions.split(',').filter(Boolean)
    : []

  // Sessions laden
  const sessions = await prisma.therapySession.findMany({
    where: {
      id: sessionIds.length > 0 ? { in: sessionIds } : undefined,
      patientId: params.id,
      billingStatus: 'UNBILLED',
      excludedFromFinances: false,
    },
    include: { serviceLines: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sessionDate: 'asc' },
  })

  // Alle offenen Sessions (für "alle auswählen") — inkl. Zusatzleistungen, damit
  // sie direkt in der Positions-Übersicht editierbar sind (nicht nur die Summe)
  const allUnbilled = await prisma.therapySession.findMany({
    where: { patientId: params.id, billingStatus: 'UNBILLED', excludedFromFinances: false },
    include: { serviceLines: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sessionDate: 'asc' },
  })

  const allUnbilledWithExtras = allUnbilled.map(s => ({
    ...s,
    serviceLinesTotalNet: s.serviceLines.reduce((sum, l) => sum + parseFloat(l.amountNet.toString()), 0),
  }))

  const invoiceTemplates = await prisma.invoiceTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const branding = await getBranding()
  const therapistName = session.user?.name ?? ''

  // Entwurf laden, falls über ?draftId= aufgerufen (Weiterbearbeiten)
  let initialDraft: any = null
  if (searchParams.draftId) {
    const d = await prisma.invoiceDraft.findFirst({
      where: { id: searchParams.draftId, patientId: params.id },
    })
    if (d) {
      initialDraft = {
        id: d.id,
        sessionIds: d.sessionIds,
        lineItemOverrides: d.lineItemOverrides,
        manualLines: d.manualLines,
        removedLineKeys: d.removedLineKeys,
        customNoteHtml: d.customNoteHtml,
        payerName: d.payerName,
        payerAddress: d.payerAddress,
        vatRate: d.vatRate ? parseFloat(d.vatRate.toString()) : null,
        paymentMethod: d.paymentMethod,
        markAsPaid: d.markAsPaid,
        generateInvoiceDoc: d.generateInvoiceDoc,
        anonymizeInvoice: d.anonymizeInvoice,
        invoiceTemplateId: d.invoiceTemplateId,
        notes: d.notes,
      }
    }
  }

  // Sonst: Hinweis auf vorhandene Entwürfe zum Weiterbearbeiten anzeigen
  const existingDrafts = !initialDraft
    ? await prisma.invoiceDraft.findMany({
        where: { patientId: params.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, updatedAt: true },
      })
    : []

  return (
    <PageShell>
      <AbrechnenClient
        patient={patient as any}
        sessions={sessions as any}
        allUnbilled={allUnbilledWithExtras as any}
        invoiceTemplates={invoiceTemplates}
        therapistName={therapistName}
        role={role}
        initialDraft={initialDraft}
        existingDrafts={existingDrafts as any}
        branding={{
          praxisName: branding.praxisName,
          address: branding.address,
          contactEmail: branding.contactEmail,
          contactPhone: branding.contactPhone,
          logoBase64: branding.logoBase64,
          logoMimeType: branding.logoMimeType,
          colorPrimary: branding.colorPrimary,
        }}
      />
    </PageShell>
  )
}

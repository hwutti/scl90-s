import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { AbrechnenClient } from './AbrechnenClient'

export default async function AbrechnenPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { sessions?: string }
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
    orderBy: { sessionDate: 'asc' },
  })

  // Alle offenen Sessions (für "alle auswählen")
  const allUnbilled = await prisma.therapySession.findMany({
    where: { patientId: params.id, billingStatus: 'UNBILLED', excludedFromFinances: false },
    select: { id: true, name: true, sessionDate: true, calculatedPriceNet: true, durationMinutes: true },
    orderBy: { sessionDate: 'asc' },
  })

  const invoiceTemplates = await prisma.invoiceTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const therapistName = session.user?.name ?? ''

  return (
    <PageShell>
      <AbrechnenClient
        patient={patient as any}
        sessions={sessions as any}
        allUnbilled={allUnbilled as any}
        invoiceTemplates={invoiceTemplates}
        therapistName={therapistName}
        role={role}
      />
    </PageShell>
  )
}

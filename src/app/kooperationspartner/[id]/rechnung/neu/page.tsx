import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getBranding } from '@/lib/branding'
import { KooperationspartnerRechnungClient } from './KooperationspartnerRechnungClient'

export default async function KooperationspartnerRechnungPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) redirect('/my')

  const partner = await prisma.cooperationPartner.findUnique({ where: { id: params.id } })
  if (!partner || !partner.isActive) notFound()

  const unbilledSessions = await prisma.therapySession.findMany({
    where: {
      billingStatus: 'UNBILLED',
      excludedFromFinances: false,
      patient: { cooperationPartnerId: params.id, deletedAt: null },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      serviceLines: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: [{ sessionDate: 'asc' }],
  })

  const invoiceTemplates = await prisma.cooperationPartnerInvoiceTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const therapistName = session.user?.name ?? ''
  const branding = await getBranding()

  return (
    <KooperationspartnerRechnungClient
      partner={partner as any}
      unbilledSessions={unbilledSessions as any}
      invoiceTemplates={invoiceTemplates}
      therapistName={therapistName}
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
  )
}

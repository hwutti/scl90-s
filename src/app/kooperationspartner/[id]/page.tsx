import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { KooperationspartnerDetailClient } from './KooperationspartnerDetailClient'
import { PatientsListClient } from '@/app/patients/PatientsListClient'

export default async function KooperationspartnerDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) redirect('/my')

  const partner = await prisma.cooperationPartner.findUnique({ where: { id: params.id } })
  if (!partner || !partner.isActive) notFound()

  const patients = await prisma.patient.findMany({
    where: { cooperationPartnerId: params.id, deletedAt: null },
    include: {
      therapists: { include: { therapist: { select: { id: true, name: true } } } },
      assessments: {
        include: { result: true, instrument: { select: { code: true, shortName: true } } },
        orderBy: { createdAt: 'desc' },
      },
      patientUser: { select: { id: true, pin: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const instruments = await prisma.instrument.findMany({ where: { isActive: true } })

  const invoiceTemplates = await prisma.cooperationPartnerInvoiceTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  return (
    <div className="flex-1 flex flex-col">
      <KooperationspartnerDetailClient partner={partner as any} invoiceTemplates={invoiceTemplates} role={role} />
      <PatientsListClient
        patients={patients as any}
        instruments={instruments}
        role={role}
        cooperationPartnerId={partner.id}
        cooperationPartnerName={partner.name}
      />
    </div>
  )
}

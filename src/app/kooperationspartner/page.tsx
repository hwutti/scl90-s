import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { KooperationspartnerListClient } from './KooperationspartnerListClient'

export default async function KooperationspartnerPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) redirect('/my')

  const partners = await prisma.cooperationPartner.findMany({
    where: { isActive: true },
    include: { _count: { select: { patients: true, transactions: true } } },
    orderBy: { name: 'asc' },
  })

  const invoiceTemplates = await prisma.cooperationPartnerInvoiceTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  return (
    <div className="flex-1 flex flex-col">
      <KooperationspartnerListClient partners={partners as any} invoiceTemplates={invoiceTemplates} role={role} />
    </div>
  )
}

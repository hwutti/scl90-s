import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/patients')

  const userId = (session.user as any).id
  const googleCal = await prisma.googleCalendarConnection.findUnique({ where: { userId } })
  const invoiceTemplates = await prisma.invoiceTemplate.findMany({ where: { isActive: true } })
  const txTypes = await prisma.transactionType.findMany({ where: { active: true } })

  return <SettingsClient
    googleCal={googleCal ? { email: googleCal.googleAccountEmail, enabled: googleCal.syncEnabled, status: googleCal.syncStatus } : null}
    invoiceTemplates={invoiceTemplates}
    txTypes={txTypes}
  />
}

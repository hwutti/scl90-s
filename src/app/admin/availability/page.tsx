import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { AvailabilityClient } from './AvailabilityClient'

export default async function AvailabilityPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) redirect('/calendar')

  const [slots, absences] = await Promise.all([
    prisma.availabilitySlot.findMany({ where: { therapistId: userId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }),
    prisma.absence.findMany({ where: { therapistId: userId, endAt: { gte: new Date() } }, orderBy: { startAt: 'asc' } }),
  ])

  return <PageShell><AvailabilityClient slots={slots} absences={absences} /></PageShell>
}

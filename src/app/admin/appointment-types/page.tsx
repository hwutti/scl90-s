import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { AppointmentTypesClient } from './AppointmentTypesClient'

export default async function AppointmentTypesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!['ADMIN','THERAPIST'].includes((session.user as any).role)) redirect('/calendar')

  const types = await prisma.appointmentType.findMany({ orderBy: { name: 'asc' } })
  return <div className="flex-1 flex flex-col"><AppointmentTypesClient initial={types} role={(session.user as any).role} /></div>
}

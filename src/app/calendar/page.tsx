import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { CalendarClient } from './CalendarClient'
import { getBranding } from '@/lib/branding'

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (role === 'PATIENT') redirect('/my/appointments')

  const branding = await getBranding()

  const [types, therapists, patients] = await Promise.all([
    prisma.appointmentType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    role === 'ADMIN'
      ? prisma.user.findMany({ where: { role: { in: ['THERAPIST','ADMIN'] }, active: true }, select: { id: true, name: true } })
      : [{ id: userId, name: (session.user as any).name ?? '' }],
    prisma.patient.findMany({
      where: role === 'ADMIN' ? { deletedAt: null } : { deletedAt: null, therapists: { some: { therapistId: userId } } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }],
    }),
  ])

  return (
    <div className="flex-1 flex flex-col">
      <CalendarClient
        currentUserId={userId}
        role={role}
        types={types}
        therapists={therapists}
        patients={patients}
        bundesland={branding.bundesland ?? 'Kärnten'}
      />
    </div>
  )
}

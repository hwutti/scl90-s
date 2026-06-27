import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { AppointmentFormClient } from '@/components/calendar/AppointmentFormClient'

export default async function NewAppointmentPage({ searchParams }: { searchParams: { date?: string; therapistId?: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) redirect('/my/appointments')

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
    <PageShell>
      <AppointmentFormClient
        mode="create"
        defaultDate={searchParams.date}
        defaultTherapistId={searchParams.therapistId ?? userId}
        types={types}
        therapists={therapists}
        patients={patients}
        currentUserId={userId}
        role={role}
      />
    </PageShell>
  )
}

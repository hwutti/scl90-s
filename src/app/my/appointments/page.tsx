import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { MyAppointmentsClient } from './MyAppointmentsClient'

export default async function MyAppointmentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  if ((session.user as any).role !== 'PATIENT') redirect('/calendar')

  const patient = await prisma.patient.findUnique({
    where: { patientUserId: userId },
    include: { therapists: { include: { therapist: { select: { id: true, name: true } } } } },
  })
  if (!patient) redirect('/my')

  const appointments = await prisma.appointment.findMany({
    where: { patientId: patient.id, status: { notIn: ['CANCELLED'] } },
    include: { type: true, therapist: { select: { name: true } } },
    orderBy: { startAt: 'asc' },
  })

  const types = await prisma.appointmentType.findMany({ where: { isActive: true, isBlocker: false } })

  return (
    <PageShell>
      <MyAppointmentsClient
        appointments={appointments as any}
        therapists={patient.therapists.map(t => t.therapist)}
        types={types}
        patientId={patient.id}
      />
    </PageShell>
  )
}

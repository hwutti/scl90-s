import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { BerichtClient } from './BerichtClient'

export default async function BerichtPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) redirect('/my')

  const patient = await prisma.patient.findUnique({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, gender: true,
      dob: true,
      diagnoses: { orderBy: [{ diagnosisType: 'asc' }, { diagnosedAt: 'asc' }] },
      _count: { select: { therapySessions: true } },
    }
  })
  if (!patient) notFound()

  const firstSession = await prisma.therapySession.findFirst({
    where: { patientId: params.id },
    orderBy: { sessionDate: 'asc' },
    select: { sessionDate: true }
  })
  const lastSession = await prisma.therapySession.findFirst({
    where: { patientId: params.id },
    orderBy: { sessionDate: 'desc' },
    select: { sessionDate: true }
  })

  return (
    <PageShell>
      <BerichtClient
        patient={patient as any}
        therapistName={session.user?.name ?? ''}
        firstSessionDate={firstSession?.sessionDate?.toISOString() ?? null}
        lastSessionDate={lastSession?.sessionDate?.toISOString() ?? null}
        totalSessions={patient._count.therapySessions}
      />
    </PageShell>
  )
}

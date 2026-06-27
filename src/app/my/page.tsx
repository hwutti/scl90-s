import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { MyDashboardClient } from './MyDashboardClient'

export default async function MyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (role !== 'PATIENT') redirect('/patients')

  const patient = await prisma.patient.findUnique({
    where: { patientUserId: userId },
    include: {
      therapists: { include: { therapist: { select: { name: true } } } },
    },
  })

  const assessments = patient
    ? await prisma.assessment.findMany({
        where: { patientId: patient.id },
        include: { result: true, instrument: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  return (
    <PageShell>
      <MyDashboardClient
        patient={patient as any}
        assessments={assessments as any}
        userName={(session.user as any).name ?? ''}
      />
    </PageShell>
  )
}

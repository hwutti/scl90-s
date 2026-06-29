import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { SitzungDetailClient } from './SitzungDetailClient'

export default async function SitzungDetailPage({
  params,
}: {
  params: { id: string; sessionId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) redirect('/my')

  if (role === 'THERAPIST') {
    const rel = await prisma.therapistPatient.findUnique({
      where: { therapistId_patientId: { therapistId: userId, patientId: params.id } },
    })
    if (!rel) redirect('/patients')
  }

  const patient = await prisma.patient.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, gender: true },
  })
  if (!patient) notFound()

  const therapySession = await prisma.therapySession.findUnique({
    where: { id: params.sessionId },
    include: {
      protocols: true,
      serviceLines: true,
      _count: { select: { audioRecordings: true } },
    },
  })
  if (!therapySession || therapySession.patientId !== params.id) notFound()

  // Sitzungsnummer ermitteln (Position in der Sitzungshistorie)
  const totalSessions = await prisma.therapySession.count({
    where: { patientId: params.id },
  })

  return (
    <PageShell>
      <SitzungDetailClient
        patient={patient as any}
        therapySession={therapySession as any}
        totalSessions={totalSessions}
        role={role}
      />
    </PageShell>
  )
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { DashboardClient } from './DashboardClient'
import { formatDate } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = (session.user as any).id
  const role   = (session.user as any).role

  // Sessions laden
  const sessions = await prisma.assessmentSession.findMany({
    where: role === 'PATIENT' ? { userId } : role === 'THERAPIST'
      ? { user: { therapistId: userId } }
      : {},
    include: { result: true, user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const data = sessions.map(s => ({
    id: s.id,
    patientName: s.patientName ?? s.user.name ?? '—',
    patientGender: s.patientGender ?? '—',
    status: s.status,
    occasion: s.occasion ?? '',
    startedAt: formatDate(s.startedAt),
    completedAt: s.completedAt ? formatDate(s.completedAt) : null,
    gsi: s.result?.gsi ?? null,
    gsiT: s.result?.gsiT ?? null,
    isClinicalCase: s.result?.isClinicalCase ?? null,
    answeredTotal: 90 - (s.result?.missingTotal ?? 90),
  }))

  return (
    <PageShell>
      <DashboardClient sessions={data} role={role} userId={userId} />
    </PageShell>
  )
}

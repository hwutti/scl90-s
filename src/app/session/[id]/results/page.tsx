import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { ResultsClient } from '@/components/results/ResultsClient'
import { answersArrayToMap, computeScore } from '@/lib/scoring'

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const assessment = await prisma.assessmentSession.findUnique({
    where: { id: params.id },
    include: { answers: { orderBy: { itemNumber: 'asc' } }, result: true, normTable: true, user: { select: { name: true } } },
  })
  if (!assessment) notFound()

  await prisma.auditLog.create({
    data: { userId: (session.user as any).id, sessionId: params.id, action: 'SESSION_VIEWED' },
  }).catch(() => {})

  const answersMap = answersArrayToMap(assessment.answers)
  const normValues = assessment.normTable?.values as any ?? null

  const scoring = computeScore(
    answersMap,
    normValues,
    assessment.patientGender,
    assessment.patientDob,
  )

  return (
    <PageShell>
      <ResultsClient
        sessionId={params.id}
        patientName={assessment.patientName ?? assessment.user.name ?? '—'}
        patientGender={assessment.patientGender ?? ''}
        patientDob={assessment.patientDob ?? ''}
        occasion={assessment.occasion ?? ''}
        startedAt={assessment.startedAt.toISOString()}
        scoring={scoring}
        answers={Object.fromEntries(answersMap)}
      />
    </PageShell>
  )
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { ResultsClient } from '@/components/results/ResultsClient'
import { answersArrayToMap, computeScore } from '@/lib/scoring'

export default async function AssessmentResultsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: {
      answers: { orderBy: { itemNumber: 'asc' } },
      result: true,
      normTable: true,
      patient: true,
    },
  })
  if (!assessment) notFound()

  if (role === 'PATIENT' && assessment.patient.patientUserId !== userId) redirect('/my')

  await prisma.auditLog.create({
    data: { userId, patientId: assessment.patientId, assessmentId: params.id, action: 'ASSESSMENT_VIEWED' },
  }).catch(() => {})

  const answersMap = answersArrayToMap(assessment.answers)
  const normValues = assessment.normTable?.values as any ?? null
  const patientGender = assessment.patient.gender === 'MALE' ? 'männlich' : 'weiblich'

  const scoring = computeScore(answersMap, normValues, patientGender, assessment.patient.dob)
  const patientName = `${assessment.patient.firstName} ${assessment.patient.lastName}`

  return (
    <PageShell>
      <ResultsClient
        sessionId={assessment.id}
        patientName={patientName}
        patientGender={patientGender}
        patientDob={assessment.patient.dob}
        occasion={assessment.occasion ?? ''}
        startedAt={(assessment.startedAt ?? assessment.createdAt).toISOString()}
        scoring={scoring}
        answers={Object.fromEntries(answersMap)}
        backUrl={role === 'PATIENT' ? '/my' : `/patients/${assessment.patientId}`}
        exportUrl={`/api/assessments/${params.id}/export`}
      />
    </PageShell>
  )
}

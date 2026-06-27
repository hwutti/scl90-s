import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { QuestionnaireClient } from '@/components/questionnaire/QuestionnaireClient'

export default async function AssessmentPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: {
      answers: { orderBy: { itemNumber: 'asc' } },
      patient: true,
      instrument: true,
    },
  })
  if (!assessment) notFound()

  // Zugriffsprüfung
  if (role === 'PATIENT' && assessment.patient.patientUserId !== userId) redirect('/my')
  if (assessment.status === 'SCORED' || assessment.status === 'LOCKED') {
    redirect(`/assessment/${params.id}/results`)
  }

  const answersMap: Record<number, number | null> = {}
  for (let i = 1; i <= 90; i++) answersMap[i] = null
  for (const a of assessment.answers) answersMap[a.itemNumber] = a.value

  const patientName = `${assessment.patient.firstName} ${assessment.patient.lastName}`

  return (
    <PageShell>
      <QuestionnaireClient
        sessionId={assessment.id}
        patientName={patientName}
        patientGender={assessment.patient.gender === 'MALE' ? 'männlich' : 'weiblich'}
        patientDob={assessment.patient.dob}
        occasion={assessment.occasion ?? ''}
        initialAnswers={answersMap}
        apiBase="/api/assessments"
      />
    </PageShell>
  )
}

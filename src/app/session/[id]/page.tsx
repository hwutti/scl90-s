import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { QuestionnaireClient } from '@/components/questionnaire/QuestionnaireClient'

export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const assessment = await prisma.assessmentSession.findUnique({
    where: { id: params.id },
    include: {
      answers: { orderBy: { itemNumber: 'asc' } },
      normTable: true,
    },
  })

  if (!assessment) notFound()
  if (assessment.status === 'SCORED' || assessment.status === 'LOCKED') {
    redirect(`/session/${params.id}/results`)
  }

  const answersMap: Record<number, number | null> = {}
  for (let i = 1; i <= 90; i++) answersMap[i] = null
  for (const a of assessment.answers) answersMap[a.itemNumber] = a.value

  return (
    <PageShell>
      <QuestionnaireClient
        sessionId={assessment.id}
        patientName={assessment.patientName ?? ''}
        patientGender={assessment.patientGender ?? ''}
        patientDob={assessment.patientDob ?? ''}
        occasion={assessment.occasion ?? ''}
        initialAnswers={answersMap}
      />
    </PageShell>
  )
}

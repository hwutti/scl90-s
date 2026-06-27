import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { PatientsListClient } from './PatientsListClient'

export default async function PatientsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) redirect('/my')

  const where = role === 'ADMIN'
    ? { deletedAt: null }
    : { deletedAt: null, therapists: { some: { therapistId: userId } } }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      assessments: {
        include: { result: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      patientUser: { select: { pin: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const instruments = await prisma.instrument.findMany({ where: { isActive: true } })

  return (
    <PageShell>
      <PatientsListClient patients={patients as any} instruments={instruments} role={role} />
    </PageShell>
  )
}
EOSX
echo "✓ /patients page.tsx"

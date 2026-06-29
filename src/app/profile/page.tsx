import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true,
      active: true, createdAt: true, avatarBase64: true, avatarMime: true,
      _count: {
        select: {
          createdPatients: true,
          therapistPatients: true,
          therapySessions: true,
          createdAssessments: true,
        }
      }
    }
  })
  if (!user) redirect('/login')

  return (
    <PageShell>
      <ProfileClient user={user as any} />
    </PageShell>
  )
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { UsersClient } from './UsersClient'

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, pin: true, active: true, createdAt: true, _count: { select: { sessions: true } } },
  })

  return (
    <PageShell>
      <UsersClient users={users} currentRole={role} />
    </PageShell>
  )
}

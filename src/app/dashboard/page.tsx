import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardHomeClient } from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role === 'PATIENT') redirect('/my')

  return (
    <DashboardHomeClient
      role={role}
      userName={session.user?.name ?? 'Benutzer'}
    />
  )
}

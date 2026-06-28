import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { CalendarStatsClient } from './CalendarStatsClient'

export default async function CalendarStatsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role === 'PATIENT') redirect('/my')

  return (
    <div className="flex-1 flex flex-col">
      <CalendarStatsClient />
    </div>
  )
}

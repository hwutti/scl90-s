import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { NotificationsClient } from './NotificationsClient'

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const notifications = await prisma.notification.findMany({
    where: { userId, channel: 'IN_APP' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return <PageShell><NotificationsClient notifications={notifications as any} /></PageShell>
}

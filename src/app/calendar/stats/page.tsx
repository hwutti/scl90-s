import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { CalendarStatsClient } from './CalendarStatsClient'

export default async function CalendarStatsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (role === 'PATIENT') redirect('/my')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const where = role === 'ADMIN' ? {} : { therapistId: userId }

  const [byStatus, byType, byDay] = await Promise.all([
    prisma.appointment.groupBy({
      by: ['status'],
      where: { ...where, startAt: { gte: startOfMonth, lte: endOfMonth } },
      _count: true,
    }),
    prisma.appointment.groupBy({
      by: ['typeId'],
      where: { ...where, startAt: { gte: startOfMonth, lte: endOfMonth }, status: { notIn: ['CANCELLED'] } },
      _count: true,
    }),
    prisma.appointment.findMany({
      where: { ...where, startAt: { gte: startOfMonth, lte: endOfMonth }, status: { notIn: ['CANCELLED'] } },
      select: { startAt: true },
    }),
  ])

  const types = await prisma.appointmentType.findMany()
  const typeMap = Object.fromEntries(types.map(t => [t.id, t]))

  const dayCount = [0,0,0,0,0,0,0]
  for (const a of byDay) {
    const d = (new Date(a.startAt).getDay() + 6) % 7
    dayCount[d]++
  }

  return (
    <PageShell>
      <CalendarStatsClient
        byStatus={byStatus}
        byType={byType.map(b => ({ ...b, type: typeMap[b.typeId] }))}
        byDay={dayCount}
        month={`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`}
      />
    </PageShell>
  )
}

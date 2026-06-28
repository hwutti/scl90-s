import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  const where  = role === 'ADMIN' ? {} : { therapistId: userId }
  const pWhere = role === 'ADMIN' ? {} : { therapists: { some: { therapistId: userId } } }

  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week  = new Date(today.getTime() - 6 * 24 * 3600000)
  const month = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalPatients, activePatients,
    totalSessions, sessionsThisMonth,
    totalTransactions, unpaidAmount, unbilledCount,
    upcomingAppointments, todayAppointments,
    recentSessions, activityData,
    notesCount,
  ] = await Promise.all([
    prisma.patient.count({ where: pWhere }),
    prisma.patient.count({ where: { ...pWhere, active: true } }),
    prisma.therapySession.count({ where }),
    prisma.therapySession.count({ where: { ...where, sessionDate: { gte: month } } }),
    prisma.transaction.count({ where: { ...( role !== 'ADMIN' ? { createdByUserId: userId } : {} ), lifecycleStatus: 'ACTIVE' } }),
    prisma.transaction.aggregate({
      where: { ...( role !== 'ADMIN' ? { createdByUserId: userId } : {} ), paymentStatus: 'UNPAID', lifecycleStatus: 'ACTIVE', direction: 'INCOME' },
      _sum: { amountGross: true },
    }),
    prisma.therapySession.count({ where: { ...where, billingStatus: 'UNBILLED' } }),
    prisma.appointment.count({ where: { ...where, startAt: { gte: now }, status: { notIn: ['CANCELLED'] } } }),
    prisma.appointment.count({ where: { ...where, startAt: { gte: today, lt: new Date(today.getTime() + 24*3600000) }, status: { notIn: ['CANCELLED'] } } }),
    prisma.therapySession.findMany({
      where, orderBy: { sessionDate: 'desc' }, take: 8,
      include: { patient: { select: { firstName: true, lastName: true, codeName: true } } },
    }),
    // Activity last 14 days
    prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', "sessionDate") as day,
        COUNT(*) as sessions
      FROM "TherapySession"
      WHERE "sessionDate" >= NOW() - INTERVAL '14 days'
      ${role !== 'ADMIN' ? prisma.$queryRaw`AND "therapistId" = ${userId}` : prisma.$queryRaw``}
      GROUP BY day ORDER BY day ASC
    `.catch(() => []),
    prisma.sessionNote.count({ where: { patient: pWhere } }),
  ])

  // Manual activity calculation
  const activityRaw = await prisma.therapySession.groupBy({
    by: ['sessionDate'],
    where: { ...where, sessionDate: { gte: new Date(Date.now() - 14*24*3600000) } },
    _count: { id: true },
    orderBy: { sessionDate: 'asc' },
  })

  const txActivity = await prisma.transaction.groupBy({
    by: ['transactionDate'],
    where: {
      ...(role !== 'ADMIN' ? { createdByUserId: userId } : {}),
      transactionDate: { gte: new Date(Date.now() - 14*24*3600000) },
      lifecycleStatus: 'ACTIVE',
    },
    _count: { id: true },
    orderBy: { transactionDate: 'asc' },
  })

  const apptActivity = await prisma.appointment.groupBy({
    by: ['startAt'],
    where: { ...where, startAt: { gte: new Date(Date.now() - 14*24*3600000) } },
    _count: { id: true },
    orderBy: { startAt: 'asc' },
  })

  // Build daily activity map for last 14 days
  const days: Record<string, { sitzungen: number; transaktionen: number; termine: number }> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i*24*3600000)
    const key = d.toISOString().slice(0,10)
    days[key] = { sitzungen: 0, transaktionen: 0, termine: 0 }
  }
  for (const row of activityRaw) {
    const k = new Date(row.sessionDate).toISOString().slice(0,10)
    if (days[k]) days[k].sitzungen = row._count.id
  }
  for (const row of txActivity) {
    const k = new Date(row.transactionDate).toISOString().slice(0,10)
    if (days[k]) days[k].transaktionen = row._count.id
  }
  for (const row of apptActivity) {
    const k = new Date(row.startAt).toISOString().slice(0,10)
    if (days[k]) days[k].termine = row._count.id
  }

  const activity = Object.entries(days).map(([date, counts]) => ({
    datum: new Intl.DateTimeFormat('de-AT', { day:'2-digit', month:'2-digit' }).format(new Date(date)),
    dateKey: date,
    isToday: date === today.toISOString().slice(0,10),
    ...counts,
  }))

  return NextResponse.json({
    stats: {
      totalPatients, activePatients,
      totalSessions, sessionsThisMonth,
      totalTransactions,
      unpaidAmount: unpaidAmount._sum.amountGross ?? 0,
      unbilledCount,
      upcomingAppointments, todayAppointments,
      notesCount,
    },
    activity,
    recentSessions: recentSessions.map(s => ({
      id: s.id,
      name: s.name,
      patientName: s.patient ? `${s.patient.lastName}, ${s.patient.firstName}` : '—',
      codeName: s.patient?.codeName,
      sessionDate: s.sessionDate,
      billingStatus: s.billingStatus,
      calculatedPriceNet: s.calculatedPriceNet,
    })),
  })
}

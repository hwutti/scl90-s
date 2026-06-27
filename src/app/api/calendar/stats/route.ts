import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const therapistId = searchParams.get('therapistId') || userId

  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const where = role === 'ADMIN' ? {} : { therapistId }

  const [total, confirmed, pending, cancelled, noShow, upcoming, waitlist] = await Promise.all([
    prisma.appointment.count({ where: { ...where, startAt: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { ...where, status: 'CONFIRMED', startAt: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { ...where, status: 'PENDING' } }),
    prisma.appointment.count({ where: { ...where, status: 'CANCELLED', startAt: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { ...where, status: 'NO_SHOW', startAt: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { ...where, status: 'CONFIRMED', startAt: { gte: now } } }),
    prisma.waitlistEntry.count({ where: { ...(role !== 'ADMIN' ? { therapistId } : {}), status: 'WAITING' } }),
  ])

  // Auslastung pro Wochentag (letzten 12 Wochen)
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000)
  const recentAppts = await prisma.appointment.findMany({
    where: { ...where, startAt: { gte: twelveWeeksAgo }, status: { notIn: ['CANCELLED'] } },
    select: { startAt: true },
  })

  const byDay = [0, 0, 0, 0, 0, 0, 0]
  for (const a of recentAppts) {
    const day = (new Date(a.startAt).getDay() + 6) % 7
    byDay[day]++
  }

  return NextResponse.json({ total, confirmed, pending, cancelled, noShow, upcoming, waitlist, byDay })
}

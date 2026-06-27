import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const where = role === 'ADMIN' ? {} : { therapistId: userId }

  const [byStatus, byTypeRaw, appts, types] = await Promise.all([
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
    prisma.appointmentType.findMany(),
  ])

  const typeMap = Object.fromEntries(types.map(t => [t.id, t]))
  const byDay = [0,0,0,0,0,0,0]
  for (const a of appts) {
    const d = (new Date(a.startAt).getDay() + 6) % 7
    byDay[d]++
  }

  return NextResponse.json({
    byStatus,
    byType: byTypeRaw.map(b => ({ ...b, type: typeMap[b.typeId] ?? null })),
    byDay,
  })
}

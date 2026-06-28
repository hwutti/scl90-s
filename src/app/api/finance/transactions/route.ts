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
  const year  = parseInt(searchParams.get('year')  ?? new Date().getFullYear().toString())
  const month = searchParams.get('month')

  const where: any = role === 'ADMIN' ? {} : { createdBy: userId }
  if (year) {
    const start = new Date(year, month ? parseInt(month)-1 : 0, 1)
    const end   = month ? new Date(year, parseInt(month), 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59)
    where.date  = { gte: start, lte: end }
  }

  const transactions = await prisma.financeTransaction.findMany({
    where, orderBy: { date: 'desc' },
    include: { patient: { select: { firstName: true, lastName: true } } },
  })
  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const tx = await prisma.financeTransaction.create({
    data: { ...body, createdBy: (session.user as any).id, date: new Date(body.date), amount: parseFloat(body.amount) },
    include: { patient: { select: { firstName: true, lastName: true } } },
  })
  return NextResponse.json(tx)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())
  const logs = await prisma.mileageLog.findMany({
    where: { createdBy: userId, date: { gte: new Date(year,0,1), lte: new Date(year,11,31,23,59,59) } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(logs)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const km  = parseFloat(body.kilometers)
  const rate = parseFloat(body.ratePerKm ?? '0.42')
  const log = await prisma.mileageLog.create({
    data: { ...body, createdBy: (session.user as any).id, date: new Date(body.date), kilometers: km, ratePerKm: rate, totalAmount: km*rate },
  })
  return NextResponse.json(log)
}

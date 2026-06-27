import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const therapistId = searchParams.get('therapistId') || (session.user as any).id

  const absences = await prisma.absence.findMany({
    where: { therapistId },
    orderBy: { startAt: 'asc' },
  })
  return NextResponse.json(absences)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { startAt, endAt, reason, note } = await req.json()

  const absence = await prisma.absence.create({
    data: { therapistId: userId, startAt: new Date(startAt), endAt: new Date(endAt), reason, note: note || null },
  })
  return NextResponse.json(absence)
}

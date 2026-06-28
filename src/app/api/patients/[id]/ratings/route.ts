import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ratings = await prisma.sessionRating.findMany({
    where: { patientId: params.id },
    orderBy: { ratingDate: 'asc' },
  })
  return NextResponse.json(ratings)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const rating = await prisma.sessionRating.create({
    data: { ...body, patientId: params.id, ratingDate: new Date(body.ratingDate ?? new Date()) },
  })
  return NextResponse.json(rating)
}

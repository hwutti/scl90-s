import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const therapistId = searchParams.get('therapistId') || (session.user as any).id

  const slots = await prisma.availabilitySlot.findMany({
    where: { therapistId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
  return NextResponse.json(slots)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { dayOfWeek, startTime, endTime, validFrom, validUntil } = await req.json()

  const slot = await prisma.availabilitySlot.create({
    data: {
      therapistId: userId, dayOfWeek, startTime, endTime,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
    },
  })
  return NextResponse.json(slot)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  await prisma.availabilitySlot.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

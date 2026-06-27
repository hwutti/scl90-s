import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const types = await prisma.appointmentType.findMany({
    where: { isActive: true, OR: [{ therapistId: null }, { therapistId: userId }] },
    orderBy: [{ therapistId: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(types)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, color, durationMin, description, isBlocker, praxisWide } = await req.json()
  const type = await prisma.appointmentType.create({
    data: {
      name, color: color ?? '#166534',
      durationMin: durationMin ?? 50,
      description: description || null,
      isBlocker: isBlocker ?? false,
      therapistId: (praxisWide && role === 'ADMIN') ? null : userId,
    },
  })
  return NextResponse.json(type)
}

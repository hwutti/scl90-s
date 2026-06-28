import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const events = await prisma.profileTimelineEvent.findMany({
    where: { patientId: params.id },
    orderBy: { eventDate: 'desc' },
    take: 50,
  })
  return NextResponse.json(events)
}

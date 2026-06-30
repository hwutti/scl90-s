import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sessions = await prisma.therapySession.findMany({
    where: { patientId: params.id },
    orderBy: [{ sessionDate: 'desc' }, { sessionNumber: 'desc' }],
    include: {
      protocols: { select: { id: true, type: true } },
      txAllocations: {
        where: { isActive: true },
        include: { transaction: { select: { paymentStatus: true, referenceNumber: true } } },
      },
    },
  })
  return NextResponse.json(sessions)
}

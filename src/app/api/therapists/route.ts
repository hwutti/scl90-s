import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const therapists = await prisma.user.findMany({
    where: { role: 'THERAPIST', active: true, id: { not: userId } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(therapists)
}

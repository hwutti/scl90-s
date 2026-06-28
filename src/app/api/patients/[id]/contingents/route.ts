import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contingents = await prisma.contingentAccount.findMany({
    where: { patientId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(contingents)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const contingent = await prisma.contingentAccount.create({
    data: {
      patientId: params.id,
      name: body.name,
      initialUnits: parseFloat(body.initialUnits),
      remainingUnits: parseFloat(body.initialUnits),
      unitLabel: body.unitLabel ?? 'sessions',
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    },
  })
  return NextResponse.json(contingent, { status: 201 })
}

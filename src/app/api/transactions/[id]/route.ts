import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      lineItems: { orderBy: { sortOrder: 'asc' } },
      sessionAllocations: {
        include: { session: { select: { id: true, name: true, sessionDate: true, calculatedPriceNet: true } } },
      },
      invoiceDocuments: { where: { deletedAt: null } },
    },
  })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tx)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const tx = await prisma.transaction.update({ where: { id: params.id }, data: body })
  return NextResponse.json(tx)
}

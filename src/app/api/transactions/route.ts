import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const patientId = searchParams.get('patientId')
  const cooperationPartnerId = searchParams.get('cooperationPartnerId')
  const direction = searchParams.get('direction')

  const where: any = role === 'ADMIN' ? {} : { createdByUserId: userId }
  if (patientId) where.patientId = patientId
  if (cooperationPartnerId) where.cooperationPartnerId = cooperationPartnerId
  if (direction) where.direction = direction
  if (year) {
    where.transactionDate = {
      gte: new Date(parseInt(year), 0, 1),
      lte: new Date(parseInt(year), 11, 31, 23, 59, 59),
    }
  }

  const txs = await prisma.transaction.findMany({
    where,
    orderBy: { transactionDate: 'desc' },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      lineItems: true,
      invoiceDocuments: { where: { deletedAt: null }, select: { id: true, documentType: true, createdAt: true } },
      _count: { select: { sessionAllocations: true } },
    },
  })
  return NextResponse.json(txs)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const userId = (session.user as any).id

  const { reserveReferenceNumber } = await import('@/lib/services/transaction.service')
  const refNum = await reserveReferenceNumber({ direction: body.direction ?? 'INCOME' })

  const tx = await prisma.transaction.create({
    data: {
      ...body,
      createdByUserId: userId,
      referenceNumber: refNum,
      transactionDate: new Date(body.transactionDate ?? new Date()),
      amountNet: parseFloat(body.amountNet),
      vatRate: parseFloat(body.vatRate ?? 0),
      vatAmount: parseFloat(body.vatAmount ?? 0),
      amountGross: parseFloat(body.amountGross),
      lifecycleStatus: 'ACTIVE',
    },
  })
  return NextResponse.json(tx)
}

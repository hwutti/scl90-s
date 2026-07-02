import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaffSession, buildAccessibleTransactionWhere, canAccessPatient, canAccessCooperationPartner } from '@/lib/access'

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error
  const { userId, role } = auth
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const patientId = searchParams.get('patientId')
  const cooperationPartnerId = searchParams.get('cooperationPartnerId')
  const direction = searchParams.get('direction')

  const where: any = await buildAccessibleTransactionWhere(userId, role)
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
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error
  const { userId, role } = auth
  const body = await req.json()

  // Serverseitige Validierung: Therapeut:innen dürfen Transaktionen nur zu
  // Patient:innen anlegen, auf die sie Zugriff haben (eigene/freigegebene),
  // bzw. zu Kooperationspartnern, auf die sie zugreifen dürfen. Admins dürfen
  // alles. Das schließt den Bypass über diese generische Route.
  if (role !== 'ADMIN') {
    if (body.patientId) {
      const ok = await canAccessPatient(userId, role, body.patientId)
      if (!ok) return NextResponse.json({ error: 'Kein Zugriff auf diese Patientin/diesen Patienten' }, { status: 403 })
    }
    if (body.cooperationPartnerId) {
      const ok = await canAccessCooperationPartner(userId, role, body.cooperationPartnerId)
      if (!ok) return NextResponse.json({ error: 'Kein Zugriff auf diesen Kooperationspartner' }, { status: 403 })
    }
  }

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

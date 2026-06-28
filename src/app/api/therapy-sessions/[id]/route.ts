import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateSessionPrice } from '@/lib/services/session.service'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ts = await prisma.therapySession.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      protocols: { include: { sections: { orderBy: { sortOrder: 'asc' } } } },
      attachments: { select: { id: true, fileName: true, mimeType: true, size: true, uploadedAt: true } },
      txAllocations: {
        where: { isActive: true },
        include: { transaction: { select: { id: true, referenceNumber: true, paymentStatus: true, amountGross: true } } },
      },
      assessmentLinks: {
        include: { assessment: { select: { id: true, status: true, createdAt: true } } },
      },
    },
  })
  if (!ts) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(ts)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const calculatedPrice = body.durationMinutes || body.unitCount
    ? calculateSessionPrice({
        billingMode: body.billingMode ?? 'time',
        durationMinutes: body.durationMinutes,
        unitCount: body.unitCount,
        unitPriceNet: body.unitPriceNet,
        hourlyRateNet: body.hourlyRateNet,
      })
    : undefined

  const ts = await prisma.therapySession.update({
    where: { id: params.id },
    data: {
      ...body,
      ...(body.sessionDate && { sessionDate: new Date(body.sessionDate) }),
      ...(calculatedPrice !== undefined && { calculatedPriceNet: calculatedPrice }),
    },
  })
  return NextResponse.json(ts)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ts = await prisma.therapySession.findUnique({ where: { id: params.id }, select: { billingStatus: true } })
  if (ts?.billingStatus !== 'UNBILLED')
    return NextResponse.json({ error: 'Nur unverrechnete Sessions können gelöscht werden' }, { status: 400 })
  await prisma.therapySession.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

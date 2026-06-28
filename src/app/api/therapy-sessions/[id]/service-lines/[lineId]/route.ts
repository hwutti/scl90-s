import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; lineId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ts = await prisma.therapySession.findUnique({
    where: { id: params.id },
    select: { billingStatus: true },
  })
  if (ts?.billingStatus === 'PAID') {
    return NextResponse.json(
      { error: 'Bezahlte Sessions können nur über Korrektur/Storno geändert werden' },
      { status: 409 }
    )
  }

  const body = await req.json()
  const qty = body.quantity !== undefined ? parseFloat(body.quantity) : undefined
  const unitPrice = body.unitPriceNet !== undefined ? parseFloat(body.unitPriceNet) : undefined
  const vatRate = body.vatRate !== undefined ? parseFloat(body.vatRate) : undefined

  // Bestehende Werte laden wenn nicht alle übermittelt
  const existing = await prisma.sessionServiceLine.findUnique({ where: { id: params.lineId } })
  if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const finalQty = qty ?? Number(existing.quantity)
  const finalPrice = unitPrice ?? Number(existing.unitPriceNet)
  const finalVat = vatRate ?? Number(existing.vatRate)
  const amountNet = finalQty * finalPrice
  const vatAmount = amountNet * finalVat
  const amountGross = amountNet + vatAmount

  const line = await prisma.sessionServiceLine.update({
    where: { id: params.lineId },
    data: {
      ...(body.description !== undefined && { description: body.description }),
      quantity: finalQty,
      unitPriceNet: finalPrice,
      vatRate: finalVat,
      amountNet,
      amountGross,
      ...(body.category !== undefined && { category: body.category }),
      ...(body.catalogCode !== undefined && { catalogCode: body.catalogCode }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  })
  return NextResponse.json(line)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; lineId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ts = await prisma.therapySession.findUnique({
    where: { id: params.id },
    select: { billingStatus: true },
  })
  if (ts?.billingStatus === 'PAID') {
    return NextResponse.json(
      { error: 'Bezahlte Sessions können nur über Korrektur/Storno geändert werden' },
      { status: 409 }
    )
  }

  await prisma.sessionServiceLine.delete({ where: { id: params.lineId } })
  return NextResponse.json({ ok: true })
}

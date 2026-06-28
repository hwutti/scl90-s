import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lines = await prisma.sessionServiceLine.findMany({
    where: { sessionId: params.id },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(lines)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Prüfen ob Session bereits verrechnet ist
  const ts = await prisma.therapySession.findUnique({
    where: { id: params.id },
    select: { billingStatus: true },
  })
  if (!ts) return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 })
  if (ts.billingStatus === 'PAID') {
    return NextResponse.json(
      { error: 'Bezahlte Sessions können nur über Korrektur/Storno geändert werden' },
      { status: 409 }
    )
  }

  const body = await req.json()
  const qty = parseFloat(body.quantity ?? 1)
  const unitPrice = parseFloat(body.unitPriceNet ?? 0)
  const vatRate = parseFloat(body.vatRate ?? 0)
  const amountNet = qty * unitPrice
  const vatAmount = amountNet * vatRate
  const amountGross = amountNet + vatAmount

  // Nächste sortOrder bestimmen
  const lastLine = await prisma.sessionServiceLine.findFirst({
    where: { sessionId: params.id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const line = await prisma.sessionServiceLine.create({
    data: {
      sessionId: params.id,
      description: body.description,
      quantity: qty,
      unitPriceNet: unitPrice,
      vatRate,
      amountNet,
      amountGross,
      sortOrder: (lastLine?.sortOrder ?? -1) + 1,
      category: body.category ?? null,
      catalogCode: body.catalogCode ?? null,
    },
  })
  return NextResponse.json(line, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.sessionTemplate.findMany({
    include: {
      shortProtocolTemplate: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      longProtocolTemplate:  { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  // Wenn isDefault: alle anderen auf false setzen
  if (body.isDefault) {
    await prisma.sessionTemplate.updateMany({ data: { isDefault: false } })
  }

  const template = await prisma.sessionTemplate.create({
    data: {
      name: body.name,
      isDefault: body.isDefault ?? false,
    },
  })
  return NextResponse.json(template, { status: 201 })
}

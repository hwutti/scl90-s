import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaffSession } from '@/lib/access'

export async function GET(_: NextRequest) {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error

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
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error
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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (body.isDefault) await prisma.invoiceTemplate.updateMany({ data: { isDefault: false } })
  const t = await prisma.invoiceTemplate.update({ where: { id: params.id }, data: body })
  return NextResponse.json(t)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.invoiceTemplate.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

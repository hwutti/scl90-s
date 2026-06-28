import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  if (body.isDefault) {
    await prisma.sessionTemplate.updateMany({ data: { isDefault: false } })
  }

  const template = await prisma.sessionTemplate.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.shortProtocolTemplateId !== undefined && { shortProtocolTemplateId: body.shortProtocolTemplateId }),
      ...(body.longProtocolTemplateId  !== undefined && { longProtocolTemplateId:  body.longProtocolTemplateId }),
    },
  })
  return NextResponse.json(template)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.sessionTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

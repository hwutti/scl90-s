import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as 'SHORT' | 'LONG' ?? 'SHORT'

  const protocol = await prisma.sessionProtocol.findUnique({
    where: { sessionId_type: { sessionId: params.id, type } },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(protocol)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const type = body.type as 'SHORT' | 'LONG'

  const protocol = await prisma.sessionProtocol.upsert({
    where: { sessionId_type: { sessionId: params.id, type } },
    create: { sessionId: params.id, type, sections: { create: body.sections ?? [] } },
    update: {},
  })

  // Update sections
  if (body.sections) {
    await prisma.sessionProtocolSection.deleteMany({ where: { protocolId: protocol.id } })
    await prisma.sessionProtocolSection.createMany({
      data: body.sections.map((s: any, i: number) => ({
        protocolId: protocol.id, title: s.title, content: s.content, sortOrder: i,
      })),
    })
  }

  const updated = await prisma.sessionProtocol.findUnique({
    where: { id: protocol.id },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(updated)
}

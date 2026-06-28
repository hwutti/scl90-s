import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string; recId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rec = await prisma.audioRecording.findFirst({
    where: { id: params.recId, sessionId: params.id },
  })
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(rec.data, {
    headers: {
      'Content-Type': rec.mimeType,
      'Content-Disposition': `attachment; filename="${rec.fileName}"`,
    },
  })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; recId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.audioRecording.deleteMany({ where: { id: params.recId, sessionId: params.id } })
  return NextResponse.json({ ok: true })
}

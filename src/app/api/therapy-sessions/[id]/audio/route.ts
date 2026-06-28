import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const recordings = await prisma.audioRecording.findMany({
    where: { sessionId: params.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, mimeType: true, size: true, durationSec: true, createdAt: true },
  })
  return NextResponse.json(recordings)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const data = Buffer.from(body.base64, 'base64')
  const rec = await prisma.audioRecording.create({
    data: {
      sessionId: params.id,
      fileName: body.fileName ?? 'aufnahme.webm',
      mimeType: body.mimeType ?? 'audio/webm',
      size: data.length,
      durationSec: body.durationSec,
      data,
      createdBy: (session.user as any).id,
    },
    select: { id: true, fileName: true, size: true, durationSec: true, createdAt: true },
  })
  return NextResponse.json(rec)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const recId = searchParams.get('recId')
  if (!recId) return NextResponse.json({ error: 'recId required' }, { status: 400 })
  await prisma.audioRecording.deleteMany({ where: { id: recId, sessionId: params.id } })
  return NextResponse.json({ ok: true })
}

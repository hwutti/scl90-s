import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NoteType } from '@prisma/client'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const notes = await prisma.sessionNote.findMany({
    where: { patientId: params.id, deletedAt: null },
    include: { author: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { date, noteType, content } = await req.json()
  if (!content) return NextResponse.json({ error: 'Inhalt fehlt' }, { status: 400 })

  const note = await prisma.sessionNote.create({
    data: {
      patientId: params.id,
      authorId: userId,
      date: date ? new Date(date) : new Date(),
      noteType: (noteType as NoteType) ?? NoteType.PROGRESS,
      content,
    },
    include: { author: { select: { name: true } } },
  })

  await prisma.auditLog.create({
    data: { userId, patientId: params.id, action: 'NOTE_CREATED' },
  }).catch(() => {})

  return NextResponse.json(note)
}

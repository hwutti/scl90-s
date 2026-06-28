import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const body = await req.json()

  const entry = await prisma.supervisionEntry.findUnique({ where: { id: params.id } })
  if (!entry) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (entry.superviseeId !== userId)
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const updated = await prisma.supervisionEntry.update({
    where: { id: params.id },
    data: {
      ...(body.date && { date: new Date(body.date) }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.supervisorName !== undefined && { supervisorName: body.supervisorName }),
      ...(body.groupParticipants !== undefined && { groupParticipants: body.groupParticipants }),
      ...(body.unitCount !== undefined && { unitCount: parseFloat(body.unitCount) }),
      ...(body.durationMinutes !== undefined && { durationMinutes: parseInt(body.durationMinutes) }),
      ...(body.supervisionType !== undefined && { supervisionType: body.supervisionType }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.fachspezifikum !== undefined && { fachspezifikum: body.fachspezifikum }),
    },
    include: { supervisor: { select: { name: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const entry = await prisma.supervisionEntry.findUnique({ where: { id: params.id } })
  if (!entry) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (entry.superviseeId !== userId)
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  await prisma.supervisionEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; confirmationId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const confirmation = await prisma.confirmation.findFirst({
    where: { id: params.confirmationId, patientId: params.id, deletedAt: null },
  })
  if (!confirmation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(confirmation)
}

const ALLOWED_FIELDS = new Set(['titel', 'inhalt', 'bemerkungen', 'datum', 'sessionId', 'templateId'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; confirmationId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'THERAPIST'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const existing = await prisma.confirmation.findFirst({
    where: { id: params.confirmationId, patientId: params.id, deletedAt: null },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) data[k] = v
  }
  if (typeof data.datum === 'string') data.datum = new Date(data.datum)
  if (data.sessionId === '') data.sessionId = null
  if (data.templateId === '') data.templateId = null

  const updated = await prisma.confirmation.update({
    where: { id: params.confirmationId },
    data,
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; confirmationId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'THERAPIST'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await prisma.confirmation.findFirst({
    where: { id: params.confirmationId, patientId: params.id, deletedAt: null },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.confirmation.update({
    where: { id: params.confirmationId },
    data: { deletedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}

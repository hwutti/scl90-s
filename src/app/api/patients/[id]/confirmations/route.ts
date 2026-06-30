import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const confirmations = await prisma.confirmation.findMany({
    where: { patientId: params.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      template: { select: { id: true, name: true } },
      documents: { where: { deletedAt: null }, select: { id: true }, take: 1 },
    },
  })

  // Sitzungsdaten (Anzeigename) für die Tabellen-Anzeige nachladen
  const sessionIds = Array.from(new Set(confirmations.map(c => c.sessionId).filter(Boolean))) as string[]
  const sessions = sessionIds.length
    ? await prisma.therapySession.findMany({ where: { id: { in: sessionIds } }, select: { id: true, name: true } })
    : []
  const sessionNameById = new Map(sessions.map(s => [s.id, s.name]))

  return NextResponse.json(confirmations.map(c => ({
    id: c.id,
    titel: c.titel,
    status: c.status,
    datum: c.datum,
    createdAt: c.createdAt,
    templateId: c.templateId,
    templateName: c.template?.name ?? null,
    sessionId: c.sessionId,
    sessionName: c.sessionId ? sessionNameById.get(c.sessionId) ?? null : null,
    hasDocument: c.documents.length > 0,
  })))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'THERAPIST'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patient = await prisma.patient.findUnique({ where: { id: params.id, deletedAt: null } })
  if (!patient) return NextResponse.json({ error: 'Patient nicht gefunden' }, { status: 404 })

  if (!body.titel) return NextResponse.json({ error: 'Titel fehlt' }, { status: 400 })

  const confirmation = await prisma.confirmation.create({
    data: {
      patientId: params.id,
      sessionId: body.sessionId || null,
      templateId: body.templateId || null,
      titel: body.titel,
      inhalt: body.inhalt ?? '',
      bemerkungen: body.bemerkungen || null,
      datum: body.datum ? new Date(body.datum) : new Date(),
      createdByUserId: (session.user as any).id,
    },
  })

  return NextResponse.json(confirmation)
}

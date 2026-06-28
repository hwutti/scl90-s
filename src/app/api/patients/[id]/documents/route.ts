import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const docs = await prisma.patientDocument.findMany({
    where: { patientId: params.id, deletedAt: null },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true, name: true, category: true, mimeType: true,
      size: true, note: true, uploadedAt: true, uploadedBy: true,
      visibility: true, sessionId: true, deletedAt: true,
    },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { name, category, mimeType, size, base64, note, sessionId, visibility } = body
  const data = Buffer.from(base64, 'base64')
  const doc = await prisma.patientDocument.create({
    data: {
      patientId: params.id,
      uploadedBy: (session.user as any).id,
      name, category: category ?? 'OTHER',
      mimeType, size, data, note: note ?? null,
      sessionId: sessionId ?? null,
      visibility: visibility ?? 'therapist',
    },
    select: { id: true, name: true, category: true, mimeType: true, size: true, note: true, uploadedAt: true, visibility: true },
  })

  // AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        patientId: params.id,
        action: 'DOCUMENT_UPLOADED' as any,
        details: { docId: doc.id, name },
      },
    })
  } catch (_) {}

  // Timeline-Event
  try {
    await prisma.profileTimelineEvent.create({
      data: {
        patientId: params.id,
        eventType: 'document_uploaded',
        relatedEntityType: 'document',
        relatedEntityId: doc.id,
        title: `Dokument hochgeladen: ${name}`,
        eventDate: new Date(),
        createdByUserId: (session.user as any).id,
      },
    })
  } catch (_) {}

  return NextResponse.json(doc)
}

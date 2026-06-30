import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptBuffer } from '@/lib/audio/crypto'

export const maxDuration = 120

// POST /api/audio — neue Aufnahme hochladen oder browser-recorded Blob speichern
// Query: ?sessionId=xxx  und/oder  ?patientId=xxx
// Body: multipart/form-data mit field "file" + optional "label" + "durationSec" + "source"
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const patientId = searchParams.get('patientId')
  if (!sessionId && !patientId) {
    return NextResponse.json({ error: 'sessionId oder patientId erforderlich.' }, { status: 400 })
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei hochgeladen.' }, { status: 400 })

  const label = formData.get('label') as string | null
  const durationSec = formData.get('durationSec') ? parseInt(formData.get('durationSec') as string) : null
  const source = (formData.get('source') as string | null) ?? 'UPLOAD'

  const plain = Buffer.from(await file.arrayBuffer())
  const { encrypted, iv } = await encryptBuffer(plain)

  const recording = await prisma.audioRecording.create({
    data: {
      sessionId: sessionId ?? null,
      patientId: patientId ?? null,
      label: label || file.name,
      fileName: file.name,
      mimeType: file.type || 'audio/webm',
      size: plain.length,
      durationSec,
      data: encrypted,
      encrypted: true,
      iv,
      source,
      createdBy: userId,
    },
  })

  return NextResponse.json({
    id: recording.id, label: recording.label, fileName: recording.fileName,
    mimeType: recording.mimeType, size: recording.size, durationSec: recording.durationSec,
    source: recording.source, createdAt: recording.createdAt,
  })
}

// GET /api/audio?sessionId=xxx  oder  ?patientId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const patientId = searchParams.get('patientId')

  const where: any = {}
  if (sessionId) where.sessionId = sessionId
  if (patientId) where.patientId = patientId
  if (!sessionId && !patientId) return NextResponse.json([])

  const recordings = await prisma.audioRecording.findMany({
    where,
    select: { id: true, label: true, fileName: true, mimeType: true, size: true, durationSec: true, source: true, createdAt: true, sessionId: true, patientId: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(recordings)
}

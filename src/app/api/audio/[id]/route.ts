import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptBuffer } from '@/lib/audio/crypto'

// GET /api/audio/[id] — entschlüsselt und streamt die Audiodatei
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recording = await prisma.audioRecording.findUnique({ where: { id: params.id } })
  if (!recording) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })

  let audioBuffer: Buffer
  if (recording.encrypted && recording.iv) {
    try {
      audioBuffer = await decryptBuffer(Buffer.from(recording.data), recording.iv)
    } catch {
      return NextResponse.json({ error: 'Entschlüsselung fehlgeschlagen.' }, { status: 500 })
    }
  } else {
    audioBuffer = Buffer.from(recording.data)
  }

  // Range-Request-Unterstützung für den Browser-Audio-Player (wichtig für seek)
  const rangeHeader = req.headers.get('range')
  const totalSize = audioBuffer.length

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : totalSize - 1
    const chunkSize = end - start + 1
    const chunk = audioBuffer.slice(start, end + 1)

    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        'Content-Type': recording.mimeType,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Cache-Control': 'no-store',
      },
    })
  }

  return new NextResponse(new Uint8Array(audioBuffer), {
    status: 200,
    headers: {
      'Content-Type': recording.mimeType,
      'Content-Length': String(totalSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="${recording.fileName}"`,
    },
  })
}

// DELETE /api/audio/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role

  const recording = await prisma.audioRecording.findUnique({ where: { id: params.id } })
  if (!recording) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })
  if (role !== 'ADMIN' && recording.createdBy !== userId) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 })
  }

  await prisma.audioRecording.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

// PATCH /api/audio/[id] — Label umbenennen
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.label) return NextResponse.json({ error: 'label fehlt.' }, { status: 400 })

  const updated = await prisma.audioRecording.update({
    where: { id: params.id },
    data: { label: body.label },
    select: { id: true, label: true },
  })
  return NextResponse.json(updated)
}

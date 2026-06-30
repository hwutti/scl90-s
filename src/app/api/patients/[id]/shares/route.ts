import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessPatient } from '@/lib/access'

// GET: Alle Freigaben für diesen Patienten
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const ok = await canAccessPatient(userId, role, params.id)
  if (!ok) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const shares = await prisma.patientShare.findMany({
    where: { patientId: params.id },
    include: { sharedWith: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json(shares)
}

// POST: Freigabe hinzufügen
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  if (!['ADMIN', 'THERAPIST'].includes(role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ok = await canAccessPatient(userId, role, params.id)
  if (!ok) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { sharedWithId, canEdit } = await req.json()
  if (!sharedWithId) return NextResponse.json({ error: 'sharedWithId fehlt' }, { status: 400 })

  const share = await prisma.patientShare.upsert({
    where: { patientId_sharedWithId: { patientId: params.id, sharedWithId } },
    create: { patientId: params.id, ownerId: userId, sharedWithId, canEdit: canEdit ?? false },
    update: { canEdit: canEdit ?? false },
    include: { sharedWith: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json(share)
}

// DELETE: Freigabe entfernen
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const { sharedWithId } = await req.json()
  const ok = await canAccessPatient(userId, role, params.id)
  if (!ok) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  await prisma.patientShare.deleteMany({
    where: { patientId: params.id, sharedWithId },
  })
  return NextResponse.json({ ok: true })
}

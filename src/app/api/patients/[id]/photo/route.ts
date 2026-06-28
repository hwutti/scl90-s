import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const photo = await prisma.patientPhoto.findUnique({ where: { patientId: params.id } })
  if (!photo) return NextResponse.json(null)
  return NextResponse.json({
    mimeType: photo.mimeType,
    data: Buffer.from(photo.data).toString('base64'),
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { base64, mimeType } = body
  const buffer = Buffer.from(base64, 'base64')
  const photo = await prisma.patientPhoto.upsert({
    where: { patientId: params.id },
    create: { patientId: params.id, data: buffer, mimeType, uploadedBy: (session.user as any).id },
    update: { data: buffer, mimeType, uploadedBy: (session.user as any).id },
  })
  return NextResponse.json({ id: photo.id })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.patientPhoto.deleteMany({ where: { patientId: params.id } })
  return NextResponse.json({ ok: true })
}

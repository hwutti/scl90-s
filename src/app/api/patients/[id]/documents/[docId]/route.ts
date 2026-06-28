import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const doc = await prisma.patientDocument.findFirst({
    where: { id: params.docId, patientId: params.id },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const base64 = Buffer.from(doc.data).toString('base64')
  return NextResponse.json({ ...doc, data: base64 })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.patientDocument.deleteMany({ where: { id: params.docId, patientId: params.id } })
  return NextResponse.json({ ok: true })
}

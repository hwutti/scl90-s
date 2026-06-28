import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const docs = await prisma.patientDocument.findMany({
    where: { patientId: params.id },
    orderBy: { uploadedAt: 'desc' },
    select: { id: true, name: true, category: true, mimeType: true, size: true, note: true, uploadedAt: true, uploadedBy: true },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { name, category, mimeType, size, base64, note } = body
  const data = Buffer.from(base64, 'base64')
  const doc = await prisma.patientDocument.create({
    data: { patientId: params.id, uploadedBy: (session.user as any).id, name, category, mimeType, size, data, note },
    select: { id: true, name: true, category: true, mimeType: true, size: true, note: true, uploadedAt: true },
  })
  return NextResponse.json(doc)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const anamnesis = await prisma.anamnesis.findUnique({
    where: { patientId: params.id },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(anamnesis)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const anamnesis = await prisma.anamnesis.upsert({
    where: { patientId: params.id },
    create: { patientId: params.id },
    update: {},
  })

  await prisma.anamnesisSection.deleteMany({ where: { anamnesisId: anamnesis.id } })
  await prisma.anamnesisSection.createMany({
    data: (body.sections ?? []).map((s: any, i: number) => ({
      anamnesisId: anamnesis.id, title: s.title, content: s.content, sortOrder: i,
    })),
  })

  const updated = await prisma.anamnesis.findUnique({
    where: { id: anamnesis.id },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(updated)
}

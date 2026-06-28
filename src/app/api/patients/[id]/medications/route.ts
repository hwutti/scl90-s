import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const meds = await prisma.medication.findMany({ where: { patientId: params.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(meds)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const med = await prisma.medication.create({
    data: { ...body, patientId: params.id, startDate: body.startDate ? new Date(body.startDate) : null },
  })
  return NextResponse.json(med)
}

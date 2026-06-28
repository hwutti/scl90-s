import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const diags = await prisma.patientDiagnosis.findMany({
    where: { patientId: params.id },
    orderBy: [{ diagnosisType: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(diags)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const diag = await prisma.patientDiagnosis.create({
    data: { ...body, patientId: params.id, createdBy: (session.user as any).id },
  })
  return NextResponse.json(diag)
}

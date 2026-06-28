import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  let codeName = body.codeName
  if (!codeName) {
    // Auto-generate: KL-001, KL-002, etc.
    const count = await prisma.patient.count()
    codeName = 'KL-' + String(count).padStart(3, '0')
  }

  const patient = await prisma.patient.update({
    where: { id: params.id },
    data: { codeName, codeNameAuto: !body.codeName },
    select: { id: true, codeName: true },
  })
  return NextResponse.json(patient)
}

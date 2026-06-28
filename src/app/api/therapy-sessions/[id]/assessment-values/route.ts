import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const values = await prisma.sessionAssessmentValue.findMany({
    where: { sessionId: params.id },
    orderBy: { assessmentName: 'asc' },
  })
  return NextResponse.json(values)
}

// PUT ersetzt alle Werte auf einmal
// body: { values: { assessmentName: string, value: number|null }[] }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const values: { assessmentName: string; value: number | null }[] = body.values ?? []

  // Upsert alle übergebenen Werte
  const results = await Promise.all(
    values.map(v =>
      prisma.sessionAssessmentValue.upsert({
        where: {
          sessionId_assessmentName: {
            sessionId: params.id,
            assessmentName: v.assessmentName,
          },
        },
        create: {
          sessionId: params.id,
          assessmentName: v.assessmentName,
          value: v.value,
          scaleMin: 0,
          scaleMax: 10,
        },
        update: { value: v.value },
      })
    )
  )
  return NextResponse.json(results)
}

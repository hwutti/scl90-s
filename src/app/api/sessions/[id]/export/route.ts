import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeScore, answersArrayToMap } from '@/lib/scoring'
import { calcAge } from '@/lib/utils'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { AuswertungPdf } from '@/lib/pdf/AuswertungPdf'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assessment = await prisma.assessmentSession.findUnique({
    where: { id: params.id },
    include: { answers: { orderBy: { itemNumber: 'asc' } }, normTable: true },
  })
  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const answersMap = answersArrayToMap(assessment.answers)
  const normValues = assessment.normTable?.values as any ?? null
  const scoring = computeScore(answersMap, normValues, assessment.patientGender, assessment.patientDob)
  const age = calcAge(assessment.patientDob)
  const date = new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

  // Answers als Record für PDF
  const answersRecord: Record<number, number | null> = {}
  for (let i = 1; i <= 90; i++) answersRecord[i] = answersMap.get(i) ?? null

  // PDF generieren
  const pdfBuffer = await renderToBuffer(
    React.createElement(AuswertungPdf, {
      patientName:   assessment.patientName   ?? '—',
      patientGender: assessment.patientGender ?? '—',
      patientDob:    assessment.patientDob    ?? '—',
      patientAge:    age,
      occasion:      assessment.occasion      ?? '—',
      date,
      scoring,
      answers: answersRecord,
    })
  )

  const filename = `SCL90S_${(assessment.patientName ?? 'Patient').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`

  await prisma.auditLog.create({
    data: { userId: (session.user as any).id, sessionId: params.id, action: 'SESSION_EXPORTED' },
  }).catch(() => {})

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

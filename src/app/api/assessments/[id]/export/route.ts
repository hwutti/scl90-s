import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeScore, answersArrayToMap } from '@/lib/scoring'
import { calcAge } from '@/lib/utils'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { AuswertungPdf, type PreviousSession } from '@/lib/pdf/AuswertungPdf'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: {
      answers: { orderBy: { itemNumber: 'asc' } },
      normTable: true,
      result: true,
      patient: true,
    },
  })
  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = (session.user as any).role
  if (role === 'PATIENT' && assessment.patient.patientUserId !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Vorherige Messungen (gleiches Instrument, gleicher Patient)
  const previousRaw = await prisma.assessment.findMany({
    where: {
      patientId: assessment.patientId,
      instrumentId: assessment.instrumentId,
      status: 'SCORED',
      id: { not: params.id },
    },
    include: { result: true },
    orderBy: { scoredAt: 'asc' },
    take: 6,
  })

  const previousSessions: PreviousSession[] = previousRaw
    .filter(p => p.result !== null)
    .map(p => {
      const scores = p.result!.scores as any
      return {
        date: new Intl.DateTimeFormat('de-AT', { dateStyle: 'short' }).format(p.scoredAt ?? p.createdAt),
        occasion: p.occasion ?? '—',
        gsi: scores?.gsi ?? null,
        gsiT: scores?.gsiT ?? null,
        isClinicalCase: p.result!.isClinicalCase,
      }
    })

  const answersMap = answersArrayToMap(assessment.answers)
  const normValues = assessment.normTable?.values as any ?? null
  const patientGender = assessment.patient.gender === 'MALE' ? 'männlich' : 'weiblich'
  const scoring = computeScore(answersMap, normValues, patientGender, assessment.patient.dob)
  const age = calcAge(assessment.patient.dob)
  const date = new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

  const answersRecord: Record<number, number | null> = {}
  for (let i = 1; i <= 90; i++) answersRecord[i] = answersMap.get(i) ?? null

  const patientName = `${assessment.patient.firstName} ${assessment.patient.lastName}`

  const element = React.createElement(AuswertungPdf, {
    patientName,
    patientGender,
    patientDob: assessment.patient.dob,
    patientAge: age,
    occasion: assessment.occasion ?? '—',
    date,
    scoring,
    answers: answersRecord,
    previousSessions,
  }) as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>

  const pdfBuffer = await renderToBuffer(element)
  const filename = `SCL90S_${patientName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`

  await prisma.auditLog.create({
    data: { userId, patientId: assessment.patientId, assessmentId: params.id, action: 'ASSESSMENT_EXPORTED' },
  }).catch(() => {})

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

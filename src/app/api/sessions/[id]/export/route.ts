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

  const assessment = await prisma.assessmentSession.findUnique({
    where: { id: params.id },
    include: { answers: { orderBy: { itemNumber: 'asc' } }, normTable: true, result: true },
  })
  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ─── Vorherige Messungen desselben Patienten ───────────────────────────────
  // Identifikation über userId + patientName + patientDob
  const previousRaw = await prisma.assessmentSession.findMany({
    where: {
      userId:       assessment.userId,
      patientName:  assessment.patientName,
      patientDob:   assessment.patientDob,
      status:       'SCORED',
      id:           { not: params.id },
    },
    include: { result: true },
    orderBy: { scoredAt: 'asc' },
    take: 6,  // max. 6 Vorwerte anzeigen
  })

  const previousSessions: PreviousSession[] = previousRaw
    .filter(p => p.result !== null)
    .map(p => ({
      date: new Intl.DateTimeFormat('de-AT', { dateStyle: 'short' }).format(p.scoredAt ?? p.createdAt),
      occasion: p.occasion ?? '—',
      gsi: p.result!.gsi,
      gsiT: p.result!.gsiT,
      isClinicalCase: p.result!.isClinicalCase,
    }))

  // ─── Scoring ──────────────────────────────────────────────────────────────
  const answersMap  = answersArrayToMap(assessment.answers)
  const normValues  = assessment.normTable?.values as any ?? null
  const scoring     = computeScore(answersMap, normValues, assessment.patientGender, assessment.patientDob)
  const age         = calcAge(assessment.patientDob)
  const date        = new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

  const answersRecord: Record<number, number | null> = {}
  for (let i = 1; i <= 90; i++) answersRecord[i] = answersMap.get(i) ?? null

  // ─── PDF rendern ──────────────────────────────────────────────────────────
  const element = React.createElement(AuswertungPdf, {
    patientName:       assessment.patientName   ?? '—',
    patientGender:     assessment.patientGender ?? '—',
    patientDob:        assessment.patientDob    ?? '—',
    patientAge:        age,
    occasion:          assessment.occasion      ?? '—',
    date,
    scoring,
    answers:           answersRecord,
    previousSessions,
  }) as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>

  const pdfBuffer = await renderToBuffer(element)

  const filename = `SCL90S_${(assessment.patientName ?? 'Patient').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`

  await prisma.auditLog.create({
    data: { userId: (session.user as any).id, sessionId: params.id, action: 'SESSION_EXPORTED' },
  }).catch(() => {})

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

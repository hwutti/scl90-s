import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeScore, answersArrayToMap } from '@/lib/scoring'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: {
      answers: { orderBy: { itemNumber: 'asc' } },
      normTable: true,
      patient: true,
    },
  })
  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = (session.user as any).role
  if (role === 'PATIENT' && assessment.patient.patientUserId !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const answersMap  = answersArrayToMap(assessment.answers)
  const normValues  = assessment.normTable?.values as any ?? null

  const result = computeScore(
    answersMap,
    normValues,
    assessment.patient.gender === 'MALE' ? 'männlich' : 'weiblich',
    assessment.patient.dob,
  )

  const { global: g, scales } = result
  const scaleScores: Record<string, object> = {}
  for (const s of scales) {
    scaleScores[s.id] = {
      sum: s.sum, mean: s.mean, missing: s.missing,
      pCount: s.pCount, tScore: s.tScore, risk: s.risk,
      flaggedItems: s.flaggedItems,
    }
  }

  await prisma.assessmentResult.upsert({
    where: { assessmentId: params.id },
    create: {
      assessmentId: params.id,
      scores: {
        gs: g.gs, gsi: g.gsi, pst: g.pst, psdi: g.psdi,
        missingTotal: g.missingTotal,
        gsiT: g.gsiT, pstT: g.pstT, psdiT: g.psdiT,
        ageGroup: g.ageGroup, genderUsed: g.genderUsed,
        scales: scaleScores,
      },
      isClinicalCase: g.isClinicalCase,
      clinicalSummary: g.clinicalReason,
    },
    update: {
      scores: {
        gs: g.gs, gsi: g.gsi, pst: g.pst, psdi: g.psdi,
        missingTotal: g.missingTotal,
        gsiT: g.gsiT, pstT: g.pstT, psdiT: g.psdiT,
        ageGroup: g.ageGroup, genderUsed: g.genderUsed,
        scales: scaleScores,
      },
      isClinicalCase: g.isClinicalCase,
      clinicalSummary: g.clinicalReason,
    },
  })

  await prisma.assessment.update({
    where: { id: params.id },
    data: { status: 'SCORED', scoredAt: new Date(), completedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      userId, patientId: assessment.patientId, assessmentId: params.id,
      action: 'ASSESSMENT_SCORED',
      details: { gsi: g.gsi, gsiT: g.gsiT, isClinicalCase: g.isClinicalCase },
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true, result })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeScore, answersArrayToMap } from '@/lib/scoring'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assessment = await prisma.assessmentSession.findUnique({
    where: { id: params.id },
    include: {
      answers: { orderBy: { itemNumber: 'asc' } },
      normTable: true,
    },
  })
  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const answersMap = answersArrayToMap(assessment.answers)
  const normValues = assessment.normTable?.values as any ?? null
  const result = computeScore(answersMap, normValues)

  const { global: g, scales } = result

  // Scaleresults als JSON für DB
  const scaleScores: Record<string, unknown> = {}
  for (const s of scales) {
    scaleScores[s.id] = {
      sum: s.sum, mean: s.mean, missing: s.missing,
      pCount: s.pCount, tScore: s.tScore, risk: s.risk,
      flaggedItems: s.flaggedItems,
    }
  }

  // Upsert Result
  await prisma.assessmentResult.upsert({
    where: { sessionId: params.id },
    create: {
      sessionId: params.id,
      gs: g.gs, gsi: g.gsi ?? 0, pst: g.pst, psdi: g.psdi,
      missingTotal: g.missingTotal,
      gsiT: g.gsiT, pstT: g.pstT, psdiT: g.psdiT,
      isClinicalCase: g.isClinicalCase,
      clinicalReason: g.clinicalReason,
      scaleScores,
    },
    update: {
      gs: g.gs, gsi: g.gsi ?? 0, pst: g.pst, psdi: g.psdi,
      missingTotal: g.missingTotal,
      gsiT: g.gsiT, pstT: g.pstT, psdiT: g.psdiT,
      isClinicalCase: g.isClinicalCase,
      clinicalReason: g.clinicalReason,
      scaleScores,
    },
  })

  await prisma.assessmentSession.update({
    where: { id: params.id },
    data: { status: 'SCORED', scoredAt: new Date(), completedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any).id,
      sessionId: params.id,
      action: 'SESSION_SCORED',
      details: { gsi: g.gsi, isClinicalCase: g.isClinicalCase },
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true, result })
}

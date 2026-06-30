import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TITLES: Record<string, string> = {
  therapiebericht: 'Therapiebericht',
  arztbrief:       'Arztbrief',
  verlaufsbericht: 'Verlaufsbericht',
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'THERAPIST'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const docs = await prisma.patientReportDocument.findMany({
    where: { patientId: params.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, reportType: true, createdByUserId: true, anonymized: true, createdAt: true },
  })

  const userIds = Array.from(new Set(docs.map(d => d.createdByUserId)))
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const userNameById = new Map(users.map(u => [u.id, u.name ?? 'Unbekannt']))

  return NextResponse.json(docs.map(d => ({
    id: d.id,
    reportType: d.reportType,
    reportTypeLabel: TITLES[d.reportType] ?? d.reportType,
    createdByName: userNameById.get(d.createdByUserId) ?? 'Unbekannt',
    anonymized: d.anonymized,
    createdAt: d.createdAt,
  })))
}

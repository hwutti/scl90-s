import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/therapy-sessions/[id]/exclude
// body: { exclude: boolean, reason?: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const exclude: boolean = body.exclude ?? true

  // Sicherheitsprüfung: bezahlte Sessions können nicht ausgenommen werden
  const ts = await prisma.therapySession.findUnique({
    where: { id: params.id },
    select: { billingStatus: true, patientId: true },
  })
  if (!ts) return NextResponse.json({ error: 'Sitzung nicht gefunden' }, { status: 404 })
  if (ts.billingStatus === 'PAID') {
    return NextResponse.json(
      { error: 'Bezahlte Sessions können nicht von Finanzen ausgenommen werden' },
      { status: 409 }
    )
  }

  const updated = await prisma.therapySession.update({
    where: { id: params.id },
    data: {
      excludedFromFinances: exclude,
      exclusionReason: exclude ? (body.reason ?? null) : null,
      billingStatus: exclude ? 'EXCLUDED' : 'UNBILLED',
    },
  })

  // Timeline-Event
  try {
    await prisma.profileTimelineEvent.create({
      data: {
        patientId: ts.patientId,
        eventType: exclude ? 'session_excluded_from_finances' : 'session_included_in_finances',
        relatedEntityType: 'session',
        relatedEntityId: params.id,
        title: exclude ? 'Sitzung von Finanzen ausgenommen' : 'Sitzung wieder in Finanzen',
        summary: body.reason ?? undefined,
        eventDate: new Date(),
        createdByUserId: (session.user as any).id,
      },
    })
  } catch (_) { /* Timeline-Fehler nicht weiterwerfen */ }

  return NextResponse.json(updated)
}

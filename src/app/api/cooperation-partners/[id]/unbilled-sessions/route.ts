import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/cooperation-partners/[id]/unbilled-sessions
// Liefert alle noch nicht verrechneten Sitzungen über ALLE Patienten dieses
// Partners hinweg (nicht wie bei /patients/[id]/abrechnen nur ein Patient),
// inkl. Zusatzleistungen je Sitzung für die Vorbefüllung der Positionsliste.
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.therapySession.findMany({
    where: {
      billingStatus: 'UNBILLED',
      excludedFromFinances: false,
      patient: { cooperationPartnerId: params.id, deletedAt: null },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      serviceLines: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: [{ sessionDate: 'asc' }],
  })

  return NextResponse.json(sessions)
}

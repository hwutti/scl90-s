import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/finance/dunning/[id]/pdf
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dunning = await prisma.dunning.findUnique({
    where: { id: params.id },
    include: { transaction: { select: { referenceNumber: true, createdByUserId: true } } },
  })
  if (!dunning) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  if (role !== 'ADMIN' && dunning.transaction.createdByUserId !== userId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const labels: Record<string, string> = { ERINNERUNG: 'Zahlungserinnerung', MAHNUNG_1: 'Mahnung-1', MAHNUNG_2: 'Mahnung-2' }
  const filename = `${labels[dunning.level]}-${dunning.transaction.referenceNumber}.pdf`

  return new NextResponse(new Uint8Array(dunning.pdf), {
    headers: {
      'Content-Type': dunning.pdfMime,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

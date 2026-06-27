import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getFreeSlotsForTherapist } from '@/lib/calendar'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const therapistId = searchParams.get('therapistId')
  const from        = searchParams.get('from')
  const to          = searchParams.get('to')
  const duration    = parseInt(searchParams.get('duration') ?? '50')

  if (!therapistId || !from || !to)
    return NextResponse.json({ error: 'therapistId, from, to erforderlich' }, { status: 400 })

  const slots = await getFreeSlotsForTherapist(
    therapistId,
    new Date(from),
    new Date(to),
    duration,
  )

  return NextResponse.json(slots)
}

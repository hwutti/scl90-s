import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createSessionFromAppointment } from '@/lib/services/session.service'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  try {
    const result = await createSessionFromAppointment({
      appointmentId: body.appointmentId,
      therapistId: (session.user as any).id,
      serviceLabel: body.serviceLabel,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const notifications = await prisma.notification.findMany({
    where: { userId, channel: 'IN_APP' },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  const unread = notifications.filter(n => !n.readAt).length
  return NextResponse.json({ notifications, unread })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const { ids } = await req.json()

  await prisma.notification.updateMany({
    where: { userId, id: { in: ids } },
    data: { readAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}

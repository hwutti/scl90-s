import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  itemNumber: z.number().int().min(1).max(90),
  value: z.number().int().min(0).max(4),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { itemNumber, value } = parsed.data

  await prisma.answer.upsert({
    where: { sessionId_itemNumber: { sessionId: params.id, itemNumber } },
    create: { sessionId: params.id, itemNumber, value, answeredAt: new Date() },
    update: { value, answeredAt: new Date() },
  })

  // Status auf IN_PROGRESS setzen wenn nötig
  await prisma.assessmentSession.update({
    where: { id: params.id },
    data: { status: 'IN_PROGRESS', updatedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

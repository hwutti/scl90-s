import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseDunningSettings, DEFAULT_DUNNING_SETTINGS } from '@/lib/finance/dunningSettings'

// GET /api/finance/dunning/settings
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  return NextResponse.json(parseDunningSettings(config?.dunningSettings))
}

// PATCH /api/finance/dunning/settings
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'THERAPIST')
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const current = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  const merged = {
    ...parseDunningSettings(current?.dunningSettings),
    ...(body.erinnerungDays !== undefined && { erinnerungDays: Number(body.erinnerungDays) }),
    ...(body.mahnung1Days !== undefined && { mahnung1Days: Number(body.mahnung1Days) }),
    ...(body.mahnung2Days !== undefined && { mahnung2Days: Number(body.mahnung2Days) }),
  }

  await prisma.praxisConfig.upsert({
    where: { key: 'default' },
    create: { key: 'default', dunningSettings: JSON.stringify(merged) },
    update: { dunningSettings: JSON.stringify(merged), updatedBy: (session.user as any).id },
  })

  return NextResponse.json(merged)
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  await prisma.praxisConfig.updateMany({ where: { key: 'default' }, data: { dunningSettings: null } })
  return NextResponse.json(DEFAULT_DUNNING_SETTINGS)
}

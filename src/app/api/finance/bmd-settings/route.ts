import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseBmdSettings, DEFAULT_BMD_SETTINGS } from '@/lib/finance/categoryLabels'

// GET /api/finance/bmd-settings
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  return NextResponse.json(parseBmdSettings(config?.bmdSettings))
}

// PATCH /api/finance/bmd-settings
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
    ...parseBmdSettings(current?.bmdSettings),
    ...(body.erlosUstBefreit !== undefined && { erlosUstBefreit: String(body.erlosUstBefreit) }),
    ...(body.erlosUstPflichtig !== undefined && { erlosUstPflichtig: String(body.erlosUstPflichtig) }),
    ...(body.expenseAccounts !== undefined && {
      expenseAccounts: { ...parseBmdSettings(current?.bmdSettings).expenseAccounts, ...body.expenseAccounts },
    }),
  }

  await prisma.praxisConfig.upsert({
    where: { key: 'default' },
    create: { key: 'default', bmdSettings: JSON.stringify(merged) },
    update: { bmdSettings: JSON.stringify(merged), updatedBy: (session.user as any).id },
  })

  return NextResponse.json(merged)
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  await prisma.praxisConfig.updateMany({ where: { key: 'default' }, data: { bmdSettings: null } })
  return NextResponse.json(DEFAULT_BMD_SETTINGS)
}

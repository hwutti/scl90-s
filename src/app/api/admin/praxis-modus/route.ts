import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidatePracticeCache } from '@/lib/access'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  return NextResponse.json({
    practiceMode:     config?.practiceMode     ?? 'single',
    adminPermissions: config?.adminPermissions ?? null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { practiceMode, adminPermissions } = await req.json()
  if (!['single','group'].includes(practiceMode))
    return NextResponse.json({ error: 'Ungültiger Modus' }, { status: 400 })

  await prisma.praxisConfig.upsert({
    where:  { key: 'default' },
    create: { key: 'default', praxisName: 'Meine Praxis', practiceMode, adminPermissions: JSON.stringify(adminPermissions) },
    update: { practiceMode, adminPermissions: JSON.stringify(adminPermissions) },
  })

  invalidatePracticeCache()
  return NextResponse.json({ ok: true })
}

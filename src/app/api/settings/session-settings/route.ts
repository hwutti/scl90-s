import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULTS = {
  formatableProtocols: true,
  changeLog: false,
  showChanges: false,
  lazyLoading: true,
  spellCheck: false,
  extraServices: false,
}

const KEY = (userId: string) => `session_settings_${userId}`

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  // In PraxisConfig als JSON gespeichert (User-spezifisch via Key)
  const config = await prisma.praxisConfig.findFirst({ where: { key: KEY(userId) } })
  if (config?.anamnesisTemplate) {
    try {
      return NextResponse.json(JSON.parse(config.anamnesisTemplate))
    } catch { /* fallback */ }
  }
  return NextResponse.json(DEFAULTS)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const body = await req.json()

  const data = { ...DEFAULTS, ...body }
  await prisma.praxisConfig.upsert({
    where: { key: KEY(userId) },
    create: { key: KEY(userId), praxisName: 'session_settings', anamnesisTemplate: JSON.stringify(data) },
    update: { anamnesisTemplate: JSON.stringify(data) },
  })
  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseAvatarSettings, DEFAULT_AVATAR_SETTINGS, AvatarGroup } from '@/lib/avatarSettings'

const GROUPS: AvatarGroup[] = ['MALE', 'FEMALE', 'DIVERSE', 'PAIR', 'FAMILY', 'GROUP']

// GET /api/settings/avatars
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  return NextResponse.json(parseAvatarSettings(config?.avatarSettings))
}

// PATCH /api/settings/avatars — body: { seeds: { MALE, FEMALE, DIVERSE, PAIR, FAMILY, GROUP } }
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Nur Admins dürfen Avatare zuordnen' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const current = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  const currentParsed = parseAvatarSettings(current?.avatarSettings)

  const newSeeds = { ...currentParsed.seeds }
  for (const g of GROUPS) {
    if (typeof body.seeds?.[g] === 'string' && body.seeds[g].trim()) {
      newSeeds[g] = body.seeds[g].trim()
    }
  }
  const merged = { seeds: newSeeds }

  await prisma.praxisConfig.upsert({
    where: { key: 'default' },
    create: { key: 'default', avatarSettings: JSON.stringify(merged) },
    update: { avatarSettings: JSON.stringify(merged), updatedBy: (session.user as any).id },
  })

  return NextResponse.json(merged)
}

// DELETE /api/settings/avatars — auf Standard zurücksetzen
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Nur Admins dürfen Avatare zuordnen' }, { status: 403 })

  await prisma.praxisConfig.updateMany({ where: { key: 'default' }, data: { avatarSettings: null } })
  return NextResponse.json(DEFAULT_AVATAR_SETTINGS)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULTS = {
  theme: 'light',
  fontSize: 'medium',
  accentColor: '#4f46e5',
  fontFamily: 'original',
  helpToolEnabled: true,
  classicMode: false,
  backgroundImageId: null as string | null,
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const settings = await prisma.userVisualSettings.findUnique({ where: { userId } })
  return NextResponse.json(settings ?? { ...DEFAULTS, userId })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const body = await req.json()

  const updated = await prisma.userVisualSettings.upsert({
    where: { userId },
    create: {
      userId,
      theme:           body.theme           ?? DEFAULTS.theme,
      fontSize:        body.fontSize        ?? DEFAULTS.fontSize,
      accentColor:     body.accentColor     ?? DEFAULTS.accentColor,
      fontFamily:      body.fontFamily      ?? DEFAULTS.fontFamily,
      helpToolEnabled: body.helpToolEnabled ?? DEFAULTS.helpToolEnabled,
      classicMode:     body.classicMode     ?? DEFAULTS.classicMode,
    },
    update: {
      ...(body.theme           !== undefined && { theme: body.theme }),
      ...(body.fontSize        !== undefined && { fontSize: body.fontSize }),
      ...(body.accentColor     !== undefined && { accentColor: body.accentColor }),
      ...(body.fontFamily      !== undefined && { fontFamily: body.fontFamily }),
      ...(body.helpToolEnabled !== undefined && { helpToolEnabled: body.helpToolEnabled }),
      ...(body.classicMode     !== undefined && { classicMode: body.classicMode }),
    },
  })

  // Farbe auch in PraxisConfig spiegeln (globales Branding-Override)
  if (body.accentColor) {
    await prisma.praxisConfig.updateMany({
      where: { key: 'default' },
      data: { colorPrimary: body.accentColor },
    }).catch(() => {})
  }

  return NextResponse.json(updated)
}

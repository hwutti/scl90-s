import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_BRANDING } from '@/lib/branding'

export async function GET() {
  const config = await prisma.praxisConfig.findUnique({ where: { key: 'default' } })
  if (!config) return NextResponse.json(DEFAULT_BRANDING)
  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    praxisName, slogan, logoBase64, logoMimeType,
    colorPrimary, colorPrimaryLight, colorAccent, colorSidebarText,
    imprintHtml, contactEmail, contactPhone, address, bundesland,
  } = body

  const d = DEFAULT_BRANDING
  const config = await prisma.praxisConfig.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      praxisName:        praxisName        ?? d.praxisName,
      slogan:            slogan            ?? d.slogan ?? '',
      logoBase64:        logoBase64        ?? null,
      logoMimeType:      logoMimeType      ?? null,
      colorPrimary:      colorPrimary      ?? d.colorPrimary,
      colorPrimaryLight: colorPrimaryLight ?? d.colorPrimaryLight,
      colorAccent:       colorAccent       ?? d.colorAccent,
      colorSidebarText:  colorSidebarText  ?? d.colorSidebarText,
      imprintHtml:       imprintHtml       ?? '',
      contactEmail:      contactEmail      ?? '',
      contactPhone:      contactPhone      ?? '',
      address:           address           ?? '',
      bundesland:        bundesland        ?? 'Kärnten',
      updatedBy: (session.user as any).id,
    },
    update: {
      ...(praxisName        !== undefined && { praxisName }),
      ...(slogan            !== undefined && { slogan }),
      ...(logoBase64        !== undefined && { logoBase64 }),
      ...(logoMimeType      !== undefined && { logoMimeType }),
      ...(colorPrimary      !== undefined && { colorPrimary }),
      ...(colorPrimaryLight !== undefined && { colorPrimaryLight }),
      ...(colorAccent       !== undefined && { colorAccent }),
      ...(colorSidebarText  !== undefined && { colorSidebarText }),
      ...(imprintHtml       !== undefined && { imprintHtml }),
      ...(contactEmail      !== undefined && { contactEmail }),
      ...(contactPhone      !== undefined && { contactPhone }),
      ...(address           !== undefined && { address }),
      ...(bundesland        !== undefined && { bundesland }),
      updatedBy: (session.user as any).id,
    },
  })

  return NextResponse.json(config)
}

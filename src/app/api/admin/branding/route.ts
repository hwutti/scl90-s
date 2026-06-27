import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const config = await prisma.praxisConfig.findUnique({ where: { key: 'default' } })
  if (!config) {
    return NextResponse.json({
      key: 'default', praxisName: 'Psychotherapeutische Praxis',
      slogan: '', logoBase64: null, logoMimeType: null,
      colorPrimary: '#166534', colorPrimaryLight: '#dcfce7', colorAccent: '#14532d',
      imprintHtml: '', contactEmail: '', contactPhone: '', address: '',
    })
  }
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
    colorPrimary, colorPrimaryLight, colorAccent,
    imprintHtml, contactEmail, contactPhone, address, bundesland,
  } = body

  const config = await prisma.praxisConfig.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      praxisName: praxisName ?? 'Psychotherapeutische Praxis',
      slogan: slogan ?? '',
      logoBase64: logoBase64 ?? null,
      logoMimeType: logoMimeType ?? null,
      colorPrimary: colorPrimary ?? '#166534',
      colorPrimaryLight: colorPrimaryLight ?? '#dcfce7',
      colorAccent: colorAccent ?? '#14532d',
      imprintHtml: imprintHtml ?? '',
      contactEmail: contactEmail ?? '',
      contactPhone: contactPhone ?? '',
      address: address ?? '',
      bundesland: bundesland ?? 'Kärnten',
      updatedBy: (session.user as any).id,
    },
    update: {
      ...(praxisName      !== undefined && { praxisName }),
      ...(slogan          !== undefined && { slogan }),
      ...(logoBase64      !== undefined && { logoBase64 }),
      ...(logoMimeType    !== undefined && { logoMimeType }),
      ...(colorPrimary    !== undefined && { colorPrimary }),
      ...(colorPrimaryLight !== undefined && { colorPrimaryLight }),
      ...(colorAccent     !== undefined && { colorAccent }),
      ...(imprintHtml     !== undefined && { imprintHtml }),
      ...(contactEmail    !== undefined && { contactEmail }),
      ...(contactPhone    !== undefined && { contactPhone }),
      ...(address         !== undefined && { address }),
      ...(bundesland      !== undefined && { bundesland }),
      updatedBy: (session.user as any).id,
    },
  })

  return NextResponse.json(config)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_BRANDING } from '@/lib/branding'

export async function GET() {
  try {
    const config = await prisma.praxisConfig.findUnique({ where: { key: 'default' } })
    if (!config) return NextResponse.json(DEFAULT_BRANDING)
    return NextResponse.json(config)
  } catch (e) {
    return NextResponse.json(DEFAULT_BRANDING)
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const d = DEFAULT_BRANDING
  const userId = (session.user as any).id

  const baseData = {
    praxisName:        body.praxisName        ?? d.praxisName,
    slogan:            body.slogan            ?? d.slogan ?? '',
    logoBase64:        body.logoBase64        ?? null,
    logoMimeType:      body.logoMimeType      ?? null,
    colorPrimary:      body.colorPrimary      ?? d.colorPrimary,
    colorPrimaryLight: body.colorPrimaryLight ?? d.colorPrimaryLight,
    colorAccent:       body.colorAccent       ?? d.colorAccent,
    imprintHtml:       body.imprintHtml       ?? '',
    contactEmail:      body.contactEmail      ?? '',
    contactPhone:      body.contactPhone      ?? '',
    iban:              body.iban              ?? '',
    bic:               body.bic               ?? '',
    bankName:          body.bankName          ?? '',
    taxNumber:         body.taxNumber         ?? '',
    vatId:             body.vatId             ?? '',
    address:           body.address           ?? '',
    bundesland:        body.bundesland        ?? 'Kärnten',
    updatedBy:         userId,
  }

  // Try with colorSidebarText first, fall back without if column missing
  let config: any
  try {
    config = await prisma.praxisConfig.upsert({
      where: { key: 'default' },
      create: { key: 'default', ...baseData, colorSidebarText: body.colorSidebarText ?? d.colorSidebarText },
      update: { ...baseData, colorSidebarText: body.colorSidebarText ?? d.colorSidebarText },
    })
  } catch (e: any) {
    console.error('[branding] colorSidebarText not in DB yet, saving without:', e?.message)
    config = await (prisma.praxisConfig as any).upsert({
      where: { key: 'default' },
      create: { key: 'default', ...baseData },
      update: { ...baseData },
    })
  }

  return NextResponse.json(config)
}

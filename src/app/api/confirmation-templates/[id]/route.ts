import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_FIELDS = new Set([
  'name', 'description', 'htmlContent', 'bodyText', 'isDefault', 'isActive',
  'primaryColor', 'fontFamily', 'fontSize',
  'praxisName', 'praxisAddress', 'praxisPhone', 'praxisEmail',
  'taxNumber', 'vatId', 'footerText',
  'headerImageBase64', 'headerImageMime',
  'footerImageBase64', 'footerImageMime',
  'bgImageBase64', 'bgImageMime', 'bgImageOpacity', 'bgImageMode',
])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) data[k] = v
  }

  // htmlContent wird nur im rohen HTML-Editor mitgeschickt -> als manuelle Anpassung markieren
  if (typeof data.htmlContent === 'string' && data.htmlContent !== '') {
    data.customHtml = true
  }
  // Explizites Zurücksetzen auf das automatische Standard-Layout
  if (body.resetToAuto === true) {
    data.customHtml = false
  }

  try {
    if (data.isDefault) {
      await prisma.confirmationTemplate.updateMany({ data: { isDefault: false } })
    } else {
      const hasDefault = await prisma.confirmationTemplate.findFirst({ where: { isDefault: true, isActive: true } })
      if (!hasDefault) data.isDefault = true
    }
    const t = await prisma.confirmationTemplate.update({ where: { id: params.id }, data })
    return NextResponse.json(t)
  } catch (e: any) {
    console.error('ConfirmationTemplate PATCH error:', e)
    return NextResponse.json({ error: e.message ?? 'Datenbankfehler' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.confirmationTemplate.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

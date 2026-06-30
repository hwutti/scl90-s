import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED = new Set([
  'name','description','reportType','isDefault','isActive','htmlContent',
  'primaryColor','fontFamily','fontSize',
  'praxisName','praxisAddress','praxisPhone','praxisEmail','taxNumber','vatId',
  'footerText','showPageNumbers','showDataProtection',
  'headerImageBase64','headerImageMime','footerImageBase64','footerImageMime',
  'bgImageBase64','bgImageMime','bgImageOpacity','bgImageMode',
  'signatureImageBase64','signatureImageMime',
])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const data: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) data[k] = v
  }
  // htmlContent wird nur im rohen HTML-Editor mitgeschickt -> als manuelle Anpassung markieren
  if (typeof data.htmlContent === 'string') {
    data.customHtml = true
  }
  // Explizites Zurücksetzen auf das automatische Standard-Layout
  if (body.resetToAuto === true) {
    data.customHtml = false
  }
  try {
    if (data.isDefault) {
      const current = await prisma.reportTemplate.findUnique({ where: { id: params.id } })
      await prisma.reportTemplate.updateMany({
        where: { reportType: data.reportType ?? current?.reportType ?? 'all' },
        data: { isDefault: false }
      })
    } else {
      const hasDefault = await prisma.reportTemplate.findFirst({
        where: { isDefault: true, isActive: true }
      })
      if (!hasDefault) data.isDefault = true
    }
    const t = await prisma.reportTemplate.update({ where: { id: params.id }, data })
    return NextResponse.json(t)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.reportTemplate.update({
    where: { id: params.id },
    data: { isActive: false }
  })
  return NextResponse.json({ ok: true })
}

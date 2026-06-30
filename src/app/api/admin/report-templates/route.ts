import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_REPORT_HTML } from '@/lib/report/template'

const ALLOWED = new Set([
  'name','description','reportType','isDefault','isActive','htmlContent',
  'primaryColor','fontFamily','fontSize',
  'praxisName','praxisAddress','praxisPhone','praxisEmail','taxNumber','vatId',
  'footerText','showPageNumbers','showDataProtection',
  'headerImageBase64','headerImageMime','footerImageBase64','footerImageMime',
  'bgImageBase64','bgImageMime','bgImageOpacity','bgImageMode',
  'signatureImageBase64','signatureImageMime',
])

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const templates = await prisma.reportTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ reportType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
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
  if (!data.htmlContent) data.htmlContent = DEFAULT_REPORT_HTML
  else data.customHtml = true
  if (!data.reportType) data.reportType = 'all'

  try {
    if (data.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { reportType: data.reportType },
        data: { isDefault: false }
      })
    }
    // duplicateFrom
    if (body.duplicateFrom) {
      const src = await prisma.reportTemplate.findUnique({ where: { id: body.duplicateFrom } })
      if (src) {
        data.htmlContent = src.htmlContent
        data.customHtml = src.customHtml
      }
    }
    const t = await prisma.reportTemplate.create({ data })
    return NextResponse.json(t)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await prisma.confirmationTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(templates)
}

const ALLOWED_FIELDS = new Set([
  'name', 'description', 'htmlContent', 'bodyText', 'isDefault', 'isActive',
  'primaryColor', 'fontFamily', 'fontSize',
  'praxisName', 'praxisAddress', 'praxisPhone', 'praxisEmail',
  'taxNumber', 'vatId', 'footerText',
  'headerImageBase64', 'headerImageMime',
  'footerImageBase64', 'footerImageMime',
  'bgImageBase64', 'bgImageMime', 'bgImageOpacity', 'bgImageMode',
  'signatureImageBase64', 'signatureImageMime',
])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const data: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) data[k] = v
  }
  try {
    // duplicateFrom: Inhalt aus einer anderen Vorlage kopieren
    if (body.duplicateFrom) {
      const src = await prisma.confirmationTemplate.findUnique({ where: { id: body.duplicateFrom } })
      if (src) {
        data.htmlContent = src.htmlContent
        data.bodyText = src.bodyText
        data.customHtml = src.customHtml
      }
    } else if (data.htmlContent) {
      // Explizit beim Erstellen mitgeliefertes HTML gilt als manuelle Anpassung
      data.customHtml = true
    }
    if (!data.htmlContent) data.htmlContent = ''
    if (data.isDefault) await prisma.confirmationTemplate.updateMany({ data: { isDefault: false } })
    const template = await prisma.confirmationTemplate.create({ data })
    return NextResponse.json(template)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Datenbankfehler' }, { status: 500 })
  }
}

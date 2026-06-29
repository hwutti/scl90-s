import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_INVOICE_HTML } from '@/lib/invoice/template'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await prisma.invoiceTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(templates)
}

const ALLOWED_FIELDS = new Set([
  'name','description','htmlContent','cssContent','isDefault','isActive',
  'invoiceTitle','primaryColor','paymentDays',
  'iban','bic','bankName','taxNumber','vatId',
  'praxisName','praxisAddress','praxisPhone','praxisEmail',
  'footerText','showQrCode',
  'headerImageBase64','headerImageMime',
  'footerImageBase64','footerImageMime',
  'bgImageBase64','bgImageMime','bgImageOpacity','bgImageMode',
])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const data: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) data[k] = v
  }
  try {
    // duplicateFrom: HTML aus einer anderen Vorlage kopieren
    if (body.duplicateFrom) {
      const src = await prisma.invoiceTemplate.findUnique({ where: { id: body.duplicateFrom } })
      if (src) data.htmlContent = src.htmlContent
    }
    // htmlContent fallback auf Default
    if (!data.htmlContent) data.htmlContent = DEFAULT_INVOICE_HTML
    if (data.isDefault) await prisma.invoiceTemplate.updateMany({ data: { isDefault: false } })
    const template = await prisma.invoiceTemplate.create({ data })
    return NextResponse.json(template)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Datenbankfehler' }, { status: 500 })
  }
}

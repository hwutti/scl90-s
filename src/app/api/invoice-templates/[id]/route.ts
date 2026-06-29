import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Nur erlaubte Felder
  const data: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) data[k] = v
  }

  try {
    if (data.isDefault) {
      await prisma.invoiceTemplate.updateMany({ data: { isDefault: false } })
    }
    const t = await prisma.invoiceTemplate.update({ where: { id: params.id }, data })
    return NextResponse.json(t)
  } catch (e: any) {
    console.error('InvoiceTemplate PATCH error:', e)
    return NextResponse.json({ error: e.message ?? 'Datenbankfehler' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.invoiceTemplate.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

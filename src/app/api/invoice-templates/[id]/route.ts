import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/access'

const ALLOWED_FIELDS = new Set([
  'name','description','htmlContent','cssContent','isDefault','isActive',
  'invoiceTitle','primaryColor','paymentDays',
  'iban','bic','bankName','taxNumber','vatId',
  'praxisName','praxisAddress','praxisPhone','praxisEmail',
  'footerText','showQrCode',
  'headerImageBase64','headerImageMime',
  'footerImageBase64','footerImageMime',
  'bgImageBase64','bgImageMime','bgImageOpacity','bgImageMode',
  'signatureImageBase64','signatureImageMime',
])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminSession()
  if ('error' in auth) return auth.error

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
      await prisma.invoiceTemplate.updateMany({ data: { isDefault: false } })
    } else {
      // Wenn keine andere Vorlage isDefault ist -> diese als Default setzen
      const hasDefault = await prisma.invoiceTemplate.findFirst({ where: { isDefault: true, isActive: true } })
      if (!hasDefault) data.isDefault = true
    }
    const t = await prisma.invoiceTemplate.update({ where: { id: params.id }, data })
    return NextResponse.json(t)
  } catch (e: any) {
    console.error('InvoiceTemplate PATCH error:', e)
    return NextResponse.json({ error: e.message ?? 'Datenbankfehler' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminSession()
  if ('error' in auth) return auth.error
  await prisma.invoiceTemplate.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

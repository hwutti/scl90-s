import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaffSession } from '@/lib/access'

export async function GET() {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error

  const partners = await prisma.cooperationPartner.findMany({
    where: { isActive: true },
    include: { _count: { select: { patients: true, transactions: true } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(partners)
}

const ALLOWED_FIELDS = new Set([
  'name', 'address', 'postalCode', 'city', 'contactPerson', 'email', 'phone', 'uidNumber',
  'defaultVatRate', 'defaultPaymentMethod', 'defaultInvoiceTemplateId', 'notes', 'isActive',
])

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession()
  if ('error' in auth) return auth.error

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
  }

  const data: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) data[k] = v
  }
  // Leerer String ist kein gültiger Fremdschlüssel -> als "nicht gesetzt" behandeln
  if (data.defaultInvoiceTemplateId === '') data.defaultInvoiceTemplateId = null

  try {
    const partner = await prisma.cooperationPartner.create({ data })
    return NextResponse.json(partner)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Datenbankfehler' }, { status: 500 })
  }
}

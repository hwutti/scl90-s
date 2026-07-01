import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

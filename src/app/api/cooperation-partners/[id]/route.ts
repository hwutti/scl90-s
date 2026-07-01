import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_FIELDS = new Set([
  'name', 'address', 'postalCode', 'city', 'contactPerson', 'email', 'phone', 'uidNumber',
  'defaultVatRate', 'defaultPaymentMethod', 'defaultInvoiceTemplateId', 'notes', 'isActive',
])

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const partner = await prisma.cooperationPartner.findUnique({
    where: { id: params.id },
    include: { _count: { select: { patients: true, transactions: true } } },
  })
  if (!partner) return NextResponse.json({ error: 'Kooperationspartner nicht gefunden' }, { status: 404 })
  return NextResponse.json(partner)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  // Leerer String ist kein gültiger Fremdschlüssel -> als "nicht gesetzt" behandeln
  if (data.defaultInvoiceTemplateId === '') data.defaultInvoiceTemplateId = null

  try {
    const partner = await prisma.cooperationPartner.update({ where: { id: params.id }, data })
    return NextResponse.json(partner)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Datenbankfehler' }, { status: 500 })
  }
}

// Weiches Löschen (wie bei InvoiceTemplate) -- Patienten/Transaktionen des Partners bleiben erhalten
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.cooperationPartner.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

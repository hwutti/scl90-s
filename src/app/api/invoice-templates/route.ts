import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await prisma.invoiceTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (body.isDefault) await prisma.invoiceTemplate.updateMany({ data: { isDefault: false } })
  const template = await prisma.invoiceTemplate.create({ data: body })
  return NextResponse.json(template)
}

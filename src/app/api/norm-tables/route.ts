import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tables = await prisma.normTable.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(tables)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (body.isDefault) {
    await prisma.normTable.updateMany({ data: { isDefault: false } })
  }
  const table = await prisma.normTable.create({ data: body })
  return NextResponse.json(table)
}

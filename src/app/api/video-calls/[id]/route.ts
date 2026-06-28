import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const call = await prisma.videoCall.findUnique({ where: { id: params.id } })
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(call)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const call = await prisma.videoCall.update({ where: { id: params.id }, data: body })
  return NextResponse.json(call)
}

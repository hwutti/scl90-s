import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const receipts = await prisma.transactionReceipt.findMany({
    where: { transactionId: params.id, deletedAt: null },
    select: { id: true, fileName: true, mimeType: true, size: true, receiptType: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(receipts)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const body = await req.json()
  // body: { base64: string, mimeType: string, fileName: string, receiptType?: string }
  if (!body.base64 || !body.mimeType)
    return NextResponse.json({ error: 'base64 und mimeType erforderlich' }, { status: 400 })

  const data = Buffer.from(body.base64, 'base64')
  const receipt = await prisma.transactionReceipt.create({
    data: {
      transactionId: params.id,
      receiptType: body.receiptType ?? 'external_voucher',
      fileName: body.fileName ?? 'beleg',
      mimeType: body.mimeType,
      size: data.length,
      data,
    },
    select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
  })

  // AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'FINANCE_UPDATED',
        details: { transactionId: params.id, action: 'receipt_added', receiptId: receipt.id },
      },
    })
  } catch (_) {}

  return NextResponse.json(receipt, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generatePin } from '@/lib/utils'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const currentUserId = (session.user as any).id
  const currentRole   = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(currentRole))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, active, regeneratePin } = await req.json()

  const user = await prisma.user.findUnique({ where: { id: params.id } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: any = {}
  if (name     !== undefined) data.name   = name
  if (email    !== undefined) data.email  = email
  if (active   !== undefined) data.active = active
  if (password) data.passwordHash = await bcrypt.hash(password, 12)

  // Neuen PIN generieren
  if (regeneratePin && user.role === 'PATIENT') {
    let pin = generatePin()
    while (await prisma.user.findUnique({ where: { pin } })) pin = generatePin()
    data.pin = pin
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data })

  await prisma.auditLog.create({
    data: { userId: currentUserId, action: 'USER_UPDATED', details: { targetUserId: params.id } },
  }).catch(() => {})

  return NextResponse.json({ ...updated, newPin: data.pin })
}

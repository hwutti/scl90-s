import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generatePin } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN','THERAPIST'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role: newRole } = await req.json()

  const data: any = { name, role: newRole }

  if (newRole === 'PATIENT') {
    // PIN generieren (einmalig, einzigartig)
    let pin = generatePin()
    while (await prisma.user.findUnique({ where: { pin } })) pin = generatePin()
    data.pin = pin
    if (role === 'THERAPIST') data.therapistId = (session.user as any).id
  } else {
    if (!email || !password) return NextResponse.json({ error: 'Email/Password required' }, { status: 400 })
    data.email = email
    data.passwordHash = await bcrypt.hash(password, 12)
  }

  const user = await prisma.user.create({ data })

  await prisma.auditLog.create({
    data: { userId: (session.user as any).id, action: 'USER_CREATED', details: { newUserId: user.id, role: newRole } },
  }).catch(() => {})

  return NextResponse.json(user)
}
